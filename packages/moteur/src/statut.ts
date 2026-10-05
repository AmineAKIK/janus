import type { Manifeste, Reglages, Statut, TypeEtape } from '@janus/contrats'
import type { Fait, ReponseVerification } from './faits.ts'
import { points } from './points.ts'
import { ajouterJours, instantEnIso, instantEnMs, jourDe } from './temps.ts'

/** Codes stables de ce qui manque pour le statut suivant : l'interface les traduit en phrases. */
export type CodeManque =
  | 'restitution_incomplete'
  | 'consolidation_trop_tot'
  | 'consolidation_a_faire'
  | 'consolidation_cours_rouvert'
  | 'consolidation_insuffisante'
  | 'pratique_aide'
  | 'atelier_manquant'
  | 'erreur_ouverte'
  | 'verification_a_venir'
  | 'verification_a_faire'
  | 'retest_a_venir'
  | 'retest_a_faire'
  | 'aisance_non_atteinte'

/** Un manque et ses paramètres : questions ou exercices concernés, date possible, points obtenus et requis. */
export interface Manque {
  readonly code: CodeManque
  readonly questions?: readonly string[]
  readonly exercices?: readonly string[]
  readonly erreurs?: readonly string[]
  /** Instant ISO (consolidation) ou jour `AAAA-MM-JJ` (vérification, retest) à partir duquel c'est possible. */
  readonly apres?: string
  readonly points?: number
  readonly requis?: number
}

export interface ResultatBloc {
  /** Le statut affiché : le statut forcé s'il y en a un, sinon le statut calculé. */
  readonly statut: Statut
  readonly statutCalcule: Statut
  readonly force: { readonly statut: Statut; readonly raison: string } | null
  /** Date (celle du fait qui a rempli la dernière condition) de chaque palier atteint par les preuves. */
  readonly dates: {
    readonly vu: string | null
    readonly acquisProvisoirement: string | null
    readonly acquis: string | null
    readonly maitrise: string | null
  }
  readonly manque: readonly Manque[]
  /** Identifiants des erreurs critiques ouvertes, dans l'ordre où elles ont été ouvertes. */
  readonly erreursOuvertes: readonly string[]
  readonly echecsConsecutifs: number
}

type FaitDe<T extends Fait['type']> = Extract<Fait, { type: T }>
type Correction = FaitDe<'correction'>

const ETAPES_DE_COURS: ReadonlySet<TypeEtape> = new Set([
  'carte',
  'pretest',
  'explication',
  'pratique',
  'atelier',
  'aisance',
])
const STATUTS_SUFFISANTS: ReadonlySet<Statut> = new Set([
  'acquis_provisoirement',
  'acquis',
  'maitrise',
])
const MS_PAR_MINUTE = 60_000

/** Un bloc est ouvert librement si tous ses prérequis sont au moins « acquis provisoirement ». */
export function accesBloc(statutsPrerequis: readonly Statut[]): 'libre' | 'raison_requise' {
  return statutsPrerequis.every((statut) => STATUTS_SUFFISANTS.has(statut))
    ? 'libre'
    : 'raison_requise'
}

function comparer(a: string, b: string): number {
  if (a < b) return -1
  return a > b ? 1 : 0
}

/** Les faits du bloc, triés par date puis identifiant, sans doublon d'identifiant. */
function ordonner(faits: readonly Fait[], bloc: string): Fait[] {
  const vus = new Set<string>()
  return faits
    .filter((fait) => fait.bloc === bloc)
    .map((fait) => ({ fait, ms: instantEnMs(fait.date) }))
    .sort((a, b) => a.ms - b.ms || comparer(a.fait.id, b.fait.id))
    .map(({ fait }) => fait)
    .filter((fait) => {
      const nouveau = !vus.has(fait.id)
      vus.add(fait.id)
      return nouveau
    })
}

function plusTardQue(a: string, b: string | null): string {
  return b !== null && instantEnMs(b) > instantEnMs(a) ? b : a
}

function plusTard(dates: readonly string[]): string | null {
  return dates.length === 0 ? null : dates.reduce((a, b) => plusTardQue(a, b))
}

/** Les corrections du premier tour d'une série : seules elles peuvent compter. */
function estCorrectionDe(serie: Correction['serie']): (fait: Fait) => fait is Correction {
  return (fait): fait is Correction =>
    fait.type === 'correction' && fait.serie === serie && fait.tour === 1
}

// --- Restitution -----------------------------------------------------------

type Restitution =
  | { readonly vu: false; readonly manquantes: readonly string[] }
  | { readonly vu: true; readonly date: string }

function evaluerRestitution(ordonnes: readonly Fait[], manifeste: Manifeste): Restitution {
  const reponses = manifeste.restitution.map((question) => ({
    id: question.id,
    fait: ordonnes
      .filter(estCorrectionDe('restitution'))
      .find((correction) => correction.question === question.id),
  }))
  const manquantes = reponses.filter(({ fait }) => fait === undefined).map(({ id }) => id)
  const date = plusTard(reponses.flatMap(({ fait }) => (fait === undefined ? [] : [fait.date])))
  return manquantes.length > 0 || date === null ? { vu: false, manquantes } : { vu: true, date }
}

// --- Consolidation ---------------------------------------------------------

type Verdict =
  | { readonly ok: true; readonly date: string }
  | {
      readonly ok: false
      readonly manque: Manque
    }

function ouvreLeCours(manifeste: Manifeste): (fait: Fait) => boolean {
  return (fait) => {
    if (fait.type !== 'etape_vue') return false
    const type = manifeste.etapes.find((etape) => etape.id === fait.etape)?.type
    return type !== undefined && ETAPES_DE_COURS.has(type)
  }
}

function verdictSerie(
  ordonnes: readonly Fait[],
  trio: readonly Correction[],
  manifeste: Manifeste,
  reglages: Reglages,
): Verdict {
  const premierRang = Math.min(...trio.map((correction) => ordonnes.indexOf(correction)))
  const premierMs = Math.min(...trio.map((correction) => instantEnMs(correction.date)))
  const derniereDate = trio.map((correction) => correction.date).reduce(plusTardQue)
  const restitution = ordonnes.findLast(
    (fait, rang) => rang < premierRang && estCorrectionDe('restitution')(fait),
  )
  if (restitution === undefined) {
    return { ok: false, manque: { code: 'consolidation_trop_tot' } }
  }
  const finDelai =
    instantEnMs(restitution.date) + reglages.delaiConsolidationMinutes * MS_PAR_MINUTE
  if (premierMs < finDelai) {
    return {
      ok: false,
      manque: { code: 'consolidation_trop_tot', apres: instantEnIso(finDelai) },
    }
  }
  const entre = ordonnes.slice(ordonnes.indexOf(restitution) + 1, premierRang)
  if (entre.some(ouvreLeCours(manifeste))) {
    return { ok: false, manque: { code: 'consolidation_cours_rouvert' } }
  }
  const obtenus =
    trio.reduce((total, correction) => total + points(correction.niveau), 0) / trio.length
  if (obtenus < reglages.seuilConsolidation) {
    return {
      ok: false,
      manque: {
        code: 'consolidation_insuffisante',
        points: obtenus,
        requis: reglages.seuilConsolidation,
      },
    }
  }
  return { ok: true, date: derniereDate }
}

/**
 * Les réponses qui comptent (premier tour, `compte` vrai) forment des séries de 3 dans l'ordre :
 * une réponse qui ne compte pas est remplacée par la suivante. Une série valable suffit.
 */
function evaluerConsolidation(
  ordonnes: readonly Fait[],
  manifeste: Manifeste,
  reglages: Reglages,
  restitutionFinie: string,
  maintenant: string,
): Verdict {
  const comptees = ordonnes.filter(estCorrectionDe('consolidation')).filter((c) => c.compte)
  const verdicts = Array.from({ length: Math.floor(comptees.length / 3) }, (_, rang) =>
    verdictSerie(ordonnes, comptees.slice(3 * rang, 3 * rang + 3), manifeste, reglages),
  )
  const valable = verdicts.find((verdict) => verdict.ok)
  if (valable !== undefined) return valable
  const dernier = verdicts.at(-1)
  if (dernier !== undefined) return dernier
  const finDelai =
    instantEnMs(restitutionFinie) + reglages.delaiConsolidationMinutes * MS_PAR_MINUTE
  return comptees.length === 0 && instantEnMs(maintenant) < finDelai
    ? { ok: false, manque: { code: 'consolidation_trop_tot', apres: instantEnIso(finDelai) } }
    : { ok: false, manque: { code: 'consolidation_a_faire' } }
}

// --- Pratique, atelier, aisance --------------------------------------------

function evaluerPratique(ordonnes: readonly Fait[], manifeste: Manifeste) {
  const resultats = manifeste.pratique.map((exercice) => {
    const items = new Set<string>()
    const atteint = ordonnes.find((fait) => {
      if (fait.type !== 'pratique_resultat') return false
      if (fait.exercice !== exercice.id || !fait.reussi || fait.aide !== 0) return false
      items.add(fait.item)
      return items.size >= exercice.reussite
    })
    return { id: exercice.id, date: atteint?.date }
  })
  return {
    incompletes: resultats.filter(({ date }) => date === undefined).map(({ id }) => id),
    date: plusTard(resultats.flatMap(({ date }) => (date === undefined ? [] : [date]))),
  }
}

function evaluerAtelier(ordonnes: readonly Fait[], manifeste: Manifeste) {
  if (manifeste.atelier === undefined) return { ok: true, date: null }
  const reussi = ordonnes.find(
    (fait) => fait.type === 'atelier_resultat' && fait.reussi && fait.aide === 0,
  )
  return { ok: reussi !== undefined, date: reussi?.date ?? null }
}

function evaluerAisance(ordonnes: readonly Fait[], manifeste: Manifeste, reglages: Reglages) {
  const cible = manifeste.aisance
  if (cible === undefined) return { ok: true, date: null }
  const jours = new Set<string>()
  let essais = 0
  const atteint = ordonnes.find((fait) => {
    if (fait.type !== 'aisance_resultat' || !fait.reussi || fait.dureeS > cible.duree_max_s) {
      return false
    }
    essais += 1
    jours.add(jourDe(fait.date, reglages.fuseau, reglages.heureBascule))
    return essais >= cible.reussites_requises && jours.size >= cible.sur_jours_differents
  })
  return { ok: atteint !== undefined, date: atteint?.date ?? null }
}

// --- Erreurs critiques -----------------------------------------------------

function erreursDeLaQuestion(manifeste: Manifeste, question: string): readonly string[] {
  const toutes = [
    ...manifeste.restitution,
    ...manifeste.consolidation,
    ...manifeste.rappel,
    ...manifeste.differees,
  ]
  return toutes.find((candidate) => candidate.id === question)?.erreurs ?? []
}

function reponseSolide(reponse: ReponseVerification): boolean {
  return (
    reponse.tour === 1 && reponse.compte && (reponse.niveau === 'solide' || reponse.reussi === true)
  )
}

/**
 * Une erreur s'ouvre quand Amine la coche (l'IA seule n'ouvre rien) et se ferme quand il la décoche
 * ou qu'une réponse solide, au premier tour et qui compte, touche la même erreur dans une série
 * de restitution ou de consolidation, ou dans une vérification valable.
 */
function evaluerErreurs(ordonnes: readonly Fait[], manifeste: Manifeste): string[] {
  const ouvertes: string[] = []
  const fermer = (erreurs: readonly string[]) => {
    for (const erreur of erreurs) {
      const rang = ouvertes.indexOf(erreur)
      if (rang >= 0) ouvertes.splice(rang, 1)
    }
  }
  for (const fait of ordonnes) {
    if (fait.type === 'erreur_cochee' && !ouvertes.includes(fait.erreur)) ouvertes.push(fait.erreur)
    if (fait.type === 'erreur_decochee') fermer([fait.erreur])
    if (
      fait.type === 'correction' &&
      (fait.serie === 'restitution' || fait.serie === 'consolidation') &&
      fait.tour === 1 &&
      fait.compte &&
      fait.niveau === 'solide'
    ) {
      fermer(erreursDeLaQuestion(manifeste, fait.question))
    }
    if (fait.type === 'verification_terminee' && fait.valable) {
      for (const reponse of fait.reponses.filter(reponseSolide)) {
        fermer(erreursDeLaQuestion(manifeste, reponse.question))
      }
    }
  }
  return ouvertes
}

// --- Vérifications, retests ------------------------------------------------

/** Une explication solide, une tâche réussie et un transfert solide, au premier tour et qui comptent. */
function compositionReussie(reponses: readonly ReponseVerification[]): boolean {
  const reussit = (type: ReponseVerification['type']) =>
    reponses.some(
      (reponse) =>
        reponse.type === type &&
        reponse.tour === 1 &&
        reponse.compte &&
        (type === 'tache' ? reponse.reussi === true : reponse.niveau === 'solide'),
    )
  return reussit('explication') && reussit('tache') && reussit('transfert')
}

/**
 * Parcourt les vérifications valables, dans l'ordre. Une vérification faite avant son délai est
 * ignorée. Un échec compte ; `echecsAvantDescente` échecs de suite font descendre d'un cran
 * (maîtrisé vers acquis, acquis vers acquis provisoirement) et remettent le compteur à zéro ;
 * une réussite le remet à zéro.
 */
function evaluerVerifications(ordonnes: readonly Fait[], provisoire: string, reglages: Reglages) {
  const jour = (instant: string) => jourDe(instant, reglages.fuseau, reglages.heureBascule)
  let palier: 'provisoire' | 'acquis' = 'provisoire'
  let dateAcquis = provisoire
  let retest: string | null = null
  let echecs = 0
  for (const fait of ordonnes) {
    if (fait.type !== 'verification_terminee' || !fait.valable) continue
    const verification = fait.verification === 'verification'
    if (verification !== (palier === 'provisoire')) continue
    const delai = verification ? reglages.delaiVerificationJours : reglages.delaiRetestJours
    const depart = verification ? provisoire : dateAcquis
    if (jour(fait.date) < ajouterJours(jour(depart), delai)) continue
    if (compositionReussie(fait.reponses)) {
      echecs = 0
      if (verification) {
        palier = 'acquis'
        dateAcquis = fait.date
      } else {
        retest ??= fait.date
      }
    } else {
      echecs += 1
      if (echecs >= reglages.echecsAvantDescente && !verification) {
        echecs = 0
        if (retest === null) {
          palier = 'provisoire'
        } else {
          retest = null
        }
      }
    }
  }
  return { palier, dateAcquis, retest, echecs }
}

// --- Calcul du bloc --------------------------------------------------------

function evaluerForcage(ordonnes: readonly Fait[]): ResultatBloc['force'] {
  let force: ResultatBloc['force'] = null
  for (const fait of ordonnes) {
    if (fait.type === 'statut_force') force = { statut: fait.statut, raison: fait.raison }
    if (fait.type === 'force_levee') force = null
  }
  return force
}

/**
 * Calcule le statut d'un bloc depuis tous ses faits : une fonction pure, sans horloge.
 * `maintenant` ne sert qu'à dire ce qui manque (à partir de quand une étape est possible) :
 * le statut ne dépend que des dates des faits, jamais de l'heure de l'appareil.
 */
export function calculerBloc(
  faits: readonly Fait[],
  manifeste: Manifeste,
  reglages: Reglages,
  maintenant: string,
): ResultatBloc {
  const ordonnes = ordonner(faits, manifeste.bloc)
  const jour = (instant: string) => jourDe(instant, reglages.fuseau, reglages.heureBascule)
  const restitution = evaluerRestitution(ordonnes, manifeste)
  const erreursOuvertes = evaluerErreurs(ordonnes, manifeste)
  const manque: Manque[] = []

  const consolidation: Verdict = restitution.vu
    ? evaluerConsolidation(ordonnes, manifeste, reglages, restitution.date, maintenant)
    : { ok: false, manque: { code: 'restitution_incomplete', questions: restitution.manquantes } }
  const pratique = evaluerPratique(ordonnes, manifeste)
  const atelier = evaluerAtelier(ordonnes, manifeste)
  const aisance = evaluerAisance(ordonnes, manifeste, reglages)

  manque.push(...(consolidation.ok ? [] : [consolidation.manque]))
  if (restitution.vu && pratique.incompletes.length > 0) {
    manque.push({ code: 'pratique_aide', exercices: pratique.incompletes })
  }
  if (restitution.vu && !atelier.ok) manque.push({ code: 'atelier_manquant' })

  const provisoire =
    restitution.vu && consolidation.ok && pratique.incompletes.length === 0 && atelier.ok
      ? [pratique.date, atelier.date].reduce<string>(plusTardQue, consolidation.date)
      : null
  const verifications =
    provisoire === null ? null : evaluerVerifications(ordonnes, provisoire, reglages)

  if (provisoire !== null && verifications !== null) {
    const echeance = ajouterJours(
      jour(verifications.palier === 'provisoire' ? provisoire : verifications.dateAcquis),
      verifications.palier === 'provisoire'
        ? reglages.delaiVerificationJours
        : reglages.delaiRetestJours,
    )
    const futur = jour(maintenant) < echeance
    if (verifications.palier === 'provisoire') {
      manque.push({
        code: futur ? 'verification_a_venir' : 'verification_a_faire',
        apres: echeance,
      })
    } else if (verifications.retest === null) {
      manque.push({ code: futur ? 'retest_a_venir' : 'retest_a_faire', apres: echeance })
    } else if (!aisance.ok) {
      manque.push({ code: 'aisance_non_atteinte' })
    }
  }
  if (erreursOuvertes.length > 0) manque.push({ code: 'erreur_ouverte', erreurs: erreursOuvertes })

  const maitrise = verifications?.palier === 'acquis' && verifications.retest !== null && aisance.ok
  let statutDesPreuves: Statut = 'non_commence'
  if (ordonnes.length > 0) statutDesPreuves = 'en_cours'
  if (restitution.vu) statutDesPreuves = 'vu'
  if (verifications !== null) statutDesPreuves = 'acquis_provisoirement'
  if (verifications?.palier === 'acquis') statutDesPreuves = 'acquis'
  if (maitrise) statutDesPreuves = 'maitrise'

  const statutCalcule: Statut = erreursOuvertes.length > 0 ? 'a_reprendre' : statutDesPreuves
  const force = evaluerForcage(ordonnes)
  return {
    statut: force?.statut ?? statutCalcule,
    statutCalcule,
    force,
    dates: {
      vu: restitution.vu ? restitution.date : null,
      acquisProvisoirement: provisoire,
      acquis: verifications?.palier === 'acquis' ? verifications.dateAcquis : null,
      maitrise:
        maitrise && verifications.retest !== null
          ? plusTardQue(verifications.retest, aisance.date)
          : null,
    },
    manque,
    erreursOuvertes,
    echecsConsecutifs: verifications?.echecs ?? 0,
  }
}
