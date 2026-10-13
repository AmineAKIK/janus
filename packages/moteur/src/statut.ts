import type { CodeManque, Manifeste, Reglages, Statut, TypeEtape } from '@janus/contrats'
import type { Fait, ReponseVerification } from './faits.ts'
import { comparer } from './ordre.ts'
import { points } from './points.ts'
import {
  ajouterJours,
  ajouterMois,
  instantEnIso,
  instantEnMs,
  jourDe,
  MS_PAR_MINUTE,
} from './temps.ts'
import type { Jour } from './temps.ts'

export type { CodeManque }

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
  /** Vrai quand le bloc est redescendu d'un cran après des échecs de vérification et n'a pas réussi depuis. */
  readonly descendu: boolean
  /** Les dates qui alimentent le panneau « Cinq preuves » ; la file du jour s'en sert aussi pour les échéances. */
  readonly preuves: {
    /** Fin de la série de consolidation réussie. */
    readonly consolidation: string | null
    /** Fin du dernier exercice de pratique atteint à l'aide 0 ; `null` s'il n'y a pas d'exercice ou s'il en reste un. */
    readonly pratique: string | null
    /** Premier transfert solide, au premier tour et qui compte, d'une vérification valable. */
    readonly transfert: string | null
    /** Atteinte de la cible d'aisance. */
    readonly aisance: string | null
    readonly aisanceRequise: boolean
    /** Dernière vérification, dernier retest ou dernier entretien réussi parmi ceux que les règles retiennent. */
    readonly derniereReussite: string | null
    /** Retests et entretiens réussis depuis « acquis », dans l'ordre ; vide après une descente. */
    readonly reussitesDeRetest: readonly string[]
    /** Date du dernier échec retenu, tant qu'aucune réussite ne l'a suivi. */
    readonly dernierEchec: string | null
  }
}

type FaitDe<T extends Fait['type']> = Extract<Fait, { type: T }>
type Correction = FaitDe<'correction'>
type TranchageCorrection = FaitDe<'correction_tranchee'>

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

/** Un bloc est ouvert librement si tous ses prérequis sont au moins « acquis provisoirement ». */
export function accesBloc(statutsPrerequis: readonly Statut[]): 'libre' | 'raison_requise' {
  return statutsPrerequis.every((statut) => STATUTS_SUFFISANTS.has(statut))
    ? 'libre'
    : 'raison_requise'
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

/** Le dernier tranchage de chaque correction : le dernier dans l'ordre des faits l'emporte. */
type Tranchages = ReadonlyMap<string, TranchageCorrection>

function tranchagesDe(ordonnes: readonly Fait[]): Tranchages {
  const derniers = new Map<string, TranchageCorrection>()
  for (const fait of ordonnes) {
    if (fait.type === 'correction_tranchee') derniers.set(fait.correction, fait)
  }
  return derniers
}

function compteEffectif(tranchages: Tranchages, correction: Correction): boolean {
  return tranchages.get(correction.id)?.compte ?? correction.compte
}

function niveauEffectif(tranchages: Tranchages, correction: Correction): Correction['niveau'] {
  return tranchages.get(correction.id)?.niveau ?? correction.niveau
}

// --- Restitution -----------------------------------------------------------

type Restitution =
  | { readonly vu: false; readonly manquantes: readonly string[] }
  | { readonly vu: true; readonly date: string }

function evaluerRestitution(ordonnes: readonly Fait[], manifeste: Manifeste): Restitution {
  // La première réponse (premier tour) de chaque question.
  const premieres = new Map<string, Correction>()
  const dePremierTour = estCorrectionDe('restitution')
  for (const fait of ordonnes) {
    if (dePremierTour(fait) && !premieres.has(fait.question)) premieres.set(fait.question, fait)
  }
  const reponses = manifeste.restitution.map((question) => ({
    id: question.id,
    fait: premieres.get(question.id),
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

/**
 * Une réponse de consolidation qui compte. `coursAvant` est l'instant le plus tardif, parmi les faits
 * qui la précèdent, d'une réponse de restitution (premier tour) ou d'une étape qui rouvre le cours.
 */
interface Comptee {
  readonly correction: Correction
  readonly coursAvant: number
}

function verdictSerie(
  tranchages: Tranchages,
  trio: readonly Comptee[],
  reglages: Reglages,
  restitutionFinie: string,
): Verdict {
  const premierMs = Math.min(...trio.map(({ correction }) => instantEnMs(correction.date)))
  const derniereDate = trio.map(({ correction }) => correction.date).reduce(plusTardQue)
  // Une série commencée avant la fin de la restitution ne compte pas : « vu » vient d'abord.
  // Le délai court depuis la dernière réponse de restitution ou, si le cours a été rouvert depuis,
  // depuis la dernière étape de cours.
  const finDelai =
    Math.max(instantEnMs(restitutionFinie), Math.min(...trio.map(({ coursAvant }) => coursAvant))) +
    reglages.delaiConsolidationMinutes * MS_PAR_MINUTE
  if (premierMs < finDelai) {
    return {
      ok: false,
      manque: { code: 'consolidation_trop_tot', apres: instantEnIso(finDelai) },
    }
  }
  const obtenus =
    trio.reduce(
      (total, { correction }) => total + points(niveauEffectif(tranchages, correction)),
      0,
    ) / trio.length
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
 * Découpe en séries de 3 questions différentes : une réponse à une question déjà dans la série en
 * cours ne compte pas pour la série (répéter la même question ne remplace pas les deux autres).
 */
function seriesDeTrois(comptees: readonly Comptee[]): Comptee[][] {
  const series: Comptee[][] = []
  let courante: Comptee[] = []
  for (const comptee of comptees) {
    if (courante.some(({ correction }) => correction.question === comptee.correction.question)) {
      continue
    }
    courante.push(comptee)
    if (courante.length === 3) {
      series.push(courante)
      courante = []
    }
  }
  return series
}

/**
 * Les réponses qui comptent (premier tour, `compte` vrai) forment des séries de 3 questions différentes dans l'ordre :
 * une réponse qui ne compte pas est remplacée par la suivante. Une série valable suffit.
 */
function evaluerConsolidation(
  ordonnes: readonly Fait[],
  tranchages: Tranchages,
  manifeste: Manifeste,
  reglages: Reglages,
  restitutionFinie: string,
  maintenant: string,
): Verdict {
  const reserve = new Set(manifeste.consolidation.map((question) => question.id))
  const dePremierTour = estCorrectionDe('consolidation')
  const reponseDeRestitution = estCorrectionDe('restitution')
  // Le type de chaque étape ; si un identifiant se répète, la première étape l'emporte.
  const typeDeLEtape = new Map(
    manifeste.etapes.toReversed().map((etape): [string, TypeEtape] => [etape.id, etape.type]),
  )
  const ouvreLeCours = (fait: Fait): boolean => {
    if (fait.type !== 'etape_vue') return false
    const type = typeDeLEtape.get(fait.etape)
    return type !== undefined && ETAPES_DE_COURS.has(type)
  }
  const comptees: Comptee[] = []
  let coursAvant = Number.NEGATIVE_INFINITY
  for (const fait of ordonnes) {
    if (dePremierTour(fait) && compteEffectif(tranchages, fait) && reserve.has(fait.question)) {
      comptees.push({ correction: fait, coursAvant })
    }
    if (reponseDeRestitution(fait) || ouvreLeCours(fait)) {
      coursAvant = Math.max(coursAvant, instantEnMs(fait.date))
    }
  }
  // La première série valable ; à défaut, le verdict de la dernière.
  let dernier: Verdict | undefined
  for (const trio of seriesDeTrois(comptees)) {
    dernier = verdictSerie(tranchages, trio, reglages, restitutionFinie)
    if (dernier.ok) return dernier
  }
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
      if (!exercice.items.some((item) => item.id === fait.item)) return false
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

/** Les erreurs critiques de chaque question du manifeste ; si un identifiant se répète, la première question l'emporte. */
function erreursParQuestion(manifeste: Manifeste): ReadonlyMap<string, readonly string[]> {
  const toutes = [
    ...manifeste.restitution,
    ...manifeste.consolidation,
    ...manifeste.rappel,
    ...manifeste.differees,
  ]
  return new Map(
    toutes.toReversed().map(({ id, erreurs }): [string, readonly string[]] => [id, erreurs]),
  )
}

/** Une réponse réussie compte au premier tour : tâche réussie, ou explication et transfert au niveau solide. */
function reponseReussie(reponse: ReponseVerification): boolean {
  return (
    reponse.tour === 1 &&
    reponse.compte &&
    (reponse.type === 'tache' ? reponse.reussi === true : reponse.niveau === 'solide')
  )
}

/**
 * Une erreur s'ouvre quand Amine la coche (l'IA seule n'ouvre rien) et se ferme quand il la décoche
 * ou qu'une réponse réussie, au premier tour et qui compte, touche la même erreur dans une série
 * de restitution ou de consolidation, ou dans une vérification retenue par `evaluerVerifications`
 * (valable, du bon genre et à l'heure : les autres sont ignorées).
 */
function evaluerErreurs(
  ordonnes: readonly Fait[],
  tranchages: Tranchages,
  manifeste: Manifeste,
  verificationsRetenues: ReadonlySet<string>,
): string[] {
  const ouvertes: string[] = []
  let parQuestion: ReadonlyMap<string, readonly string[]> | undefined
  const erreursDeLaQuestion = (question: string): readonly string[] => {
    parQuestion ??= erreursParQuestion(manifeste)
    return parQuestion.get(question) ?? []
  }
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
      fait.type === 'erreur_ia_tranchee' &&
      fait.decision === 'confirmee' &&
      !ouvertes.includes(fait.erreur)
    ) {
      ouvertes.push(fait.erreur)
    }
    if (
      fait.type === 'correction' &&
      (fait.serie === 'restitution' || fait.serie === 'consolidation') &&
      fait.tour === 1 &&
      compteEffectif(tranchages, fait) &&
      niveauEffectif(tranchages, fait) === 'solide'
    ) {
      fermer(erreursDeLaQuestion(fait.question))
    }
    if (fait.type === 'verification_terminee' && verificationsRetenues.has(fait.id)) {
      for (const reponse of fait.reponses.filter(reponseReussie)) {
        fermer(erreursDeLaQuestion(reponse.question))
      }
    }
  }
  return ouvertes
}

// --- Vérifications, retests ------------------------------------------------

/** Une explication solide, une tâche réussie et un transfert solide, au premier tour et qui comptent. */
export function compositionReussie(reponses: readonly ReponseVerification[]): boolean {
  const reussit = (type: ReponseVerification['type']) =>
    reponses.some((reponse) => reponse.type === type && reponseReussie(reponse))
  return reussit('explication') && reussit('tache') && reussit('transfert')
}

/**
 * Le premier jour où la vérification, le retest ou l'entretien attendu peut être fait ; `null` s'il
 * n'y a pas d'échéance d'entretien dans les réglages. Le premier retest vient `delaiRetestJours`
 * jours après « acquis », puis chaque entretien `entretienMois` mois (le dernier mois se répète)
 * après la dernière réussite.
 */
function echeanceAttendue(
  attendu: 'verification' | 'retest' | 'entretien',
  dates: { provisoire: string; dateAcquis: string; derniere: string },
  reglages: Reglages,
  reussites: number,
): Jour | null {
  const jour = (instant: string) => jourDe(instant, reglages.fuseau, reglages.heureBascule)
  if (attendu === 'verification') {
    return ajouterJours(jour(dates.provisoire), reglages.delaiVerificationJours)
  }
  if (attendu === 'retest') {
    return ajouterJours(jour(dates.dateAcquis), reglages.delaiRetestJours)
  }
  const mois = reglages.entretienMois[Math.min(reussites, reglages.entretienMois.length) - 1]
  return mois === undefined ? null : ajouterMois(jour(dates.derniere), mois)
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
  let derniereReussite: string | null = null
  let dernierEchec: string | null = null
  let descendu = false
  let reussitesDeRetest: string[] = []
  // La dernière réussite retenue : le point de départ de l'entretien suivant.
  let derniere = provisoire
  const retenues = new Set<string>()
  for (const fait of ordonnes) {
    if (fait.type !== 'verification_terminee' || !fait.valable) continue
    const attendu =
      palier === 'provisoire' ? 'verification' : retest === null ? 'retest' : 'entretien'
    if (fait.verification !== attendu) continue
    const verification = attendu === 'verification'
    const echeance = echeanceAttendue(
      attendu,
      { provisoire, dateAcquis, derniere },
      reglages,
      reussitesDeRetest.length,
    )
    if (echeance === null || jour(fait.date) < echeance) continue
    retenues.add(fait.id)
    if (compositionReussie(fait.reponses)) {
      echecs = 0
      descendu = false
      derniereReussite = fait.date
      derniere = fait.date
      dernierEchec = null
      if (verification) {
        palier = 'acquis'
        dateAcquis = fait.date
      } else {
        retest ??= fait.date
        reussitesDeRetest.push(fait.date)
      }
    } else {
      echecs += 1
      dernierEchec = fait.date
      if (echecs >= reglages.echecsAvantDescente && !verification) {
        echecs = 0
        descendu = true
        reussitesDeRetest = []
        if (retest === null) {
          palier = 'provisoire'
        } else {
          retest = null
        }
      }
    }
  }
  return {
    palier,
    dateAcquis,
    retest,
    echecs,
    descendu,
    retenues,
    derniereReussite,
    dernierEchec,
    reussitesDeRetest,
  }
}

/** Le premier transfert solide, au premier tour et qui compte, d'une vérification valable. */
function premierTransfert(ordonnes: readonly Fait[]): string | null {
  const fait = ordonnes.find(
    (candidat) =>
      candidat.type === 'verification_terminee' &&
      candidat.valable &&
      candidat.reponses.some((reponse) => reponse.type === 'transfert' && reponseReussie(reponse)),
  )
  return fait?.date ?? null
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
  const tranchages = tranchagesDe(ordonnes)
  const jour = (instant: string) => jourDe(instant, reglages.fuseau, reglages.heureBascule)
  const restitution = evaluerRestitution(ordonnes, manifeste)
  const manque: Manque[] = []

  const consolidation: Verdict = restitution.vu
    ? evaluerConsolidation(ordonnes, tranchages, manifeste, reglages, restitution.date, maintenant)
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
  const erreursOuvertes = evaluerErreurs(
    ordonnes,
    tranchages,
    manifeste,
    verifications?.retenues ?? new Set<string>(),
  )

  if (provisoire !== null && verifications !== null) {
    // Même règle que `echeances` : après un échec, le nouvel essai est dû `delaiNouvelEssaiJours` plus tard.
    const echeance =
      verifications.dernierEchec === null
        ? ajouterJours(
            jour(verifications.palier === 'provisoire' ? provisoire : verifications.dateAcquis),
            verifications.palier === 'provisoire'
              ? reglages.delaiVerificationJours
              : reglages.delaiRetestJours,
          )
        : ajouterJours(jour(verifications.dernierEchec), reglages.delaiNouvelEssaiJours)
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
    descendu: verifications?.descendu ?? false,
    preuves: {
      consolidation: consolidation.ok ? consolidation.date : null,
      pratique:
        manifeste.pratique.length > 0 && pratique.incompletes.length === 0 ? pratique.date : null,
      transfert: premierTransfert(ordonnes),
      aisance: aisance.date,
      aisanceRequise: manifeste.aisance !== undefined,
      derniereReussite: verifications?.derniereReussite ?? null,
      reussitesDeRetest: verifications?.reussitesDeRetest ?? [],
      dernierEchec: verifications?.dernierEchec ?? null,
    },
  }
}
