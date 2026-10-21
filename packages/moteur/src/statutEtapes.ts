import { reservesDuType } from '@janus/contrats'
import type {
  CodeManque,
  Manifeste,
  Reglages,
  Statut,
  TypeDifferee,
  TypeEtape,
} from '@janus/contrats'
import type { Fait, ReponseVerification } from './faits.ts'
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

// Les règles du statut d'un bloc, une par « suivi » : chaque suivi lit les faits un à un, dans l'ordre
// (date puis identifiant, sans doublon), et sait dire où il en est à tout moment. `calculerBloc` les
// nourrit avec tous les faits d'un coup ; `SuiviBloc` les nourrit au fil de l'eau, pour que le statut après
// chaque fait ne coûte pas un recalcul complet.

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
  /** Les étapes de la fiche déjà affichées (`etape_vue`), dans l'ordre de leur première vue. */
  readonly etapesVues: readonly string[]
  /** Les dates qui alimentent le panneau « Cinq preuves » ; la file du jour s'en sert aussi pour les échéances. */
  readonly preuves: {
    /** Fin de la série de consolidation réussie. */
    readonly consolidation: string | null
    /** Fin du dernier exercice de pratique atteint à l'aide 0 ; `null` s'il n'y a pas d'exercice ou s'il en reste un. */
    readonly pratique: string | null
    /** Premier atelier réussi à l'aide 0 ; `null` s'il n'y a pas d'atelier ou s'il n'est pas encore réussi. */
    readonly atelier: string | null
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
export type Correction = FaitDe<'correction'>
export type TranchageCorrection = FaitDe<'correction_tranchee'>

const ETAPES_DE_COURS: ReadonlySet<TypeEtape> = new Set([
  'carte',
  'perception',
  'pretest',
  'explication',
  'ensemble',
  'pratique',
  'atelier',
  'aisance',
])

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

// --- Tranchages ------------------------------------------------------------

/** Le dernier tranchage de chaque correction : le dernier dans l'ordre des faits l'emporte. */
export type Tranchages = ReadonlyMap<string, TranchageCorrection>

export function tranchagesDe(ordonnes: readonly Fait[]): Map<string, TranchageCorrection> {
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

export type Restitution =
  | { readonly vu: false; readonly manquantes: readonly string[] }
  | { readonly vu: true; readonly date: string }

export class SuiviRestitution {
  readonly #manifeste: Manifeste
  readonly #dePremierTour = estCorrectionDe('restitution')
  /** La première réponse (premier tour) de chaque question. */
  readonly #premieres = new Map<string, Correction>()
  #connu: Restitution | undefined

  constructor(manifeste: Manifeste) {
    this.#manifeste = manifeste
  }

  avancer(fait: Fait): void {
    if (this.#dePremierTour(fait) && !this.#premieres.has(fait.question)) {
      this.#premieres.set(fait.question, fait)
      this.#connu = undefined
    }
  }

  resultat(): Restitution {
    this.#connu ??= this.#evaluer()
    return this.#connu
  }

  #evaluer(): Restitution {
    const reponses = this.#manifeste.restitution.map((question) => ({
      id: question.id,
      fait: this.#premieres.get(question.id),
    }))
    const manquantes = reponses.filter(({ fait }) => fait === undefined).map(({ id }) => id)
    const date = plusTard(reponses.flatMap(({ fait }) => (fait === undefined ? [] : [fait.date])))
    return manquantes.length > 0 || date === null ? { vu: false, manquantes } : { vu: true, date }
  }
}

// --- Consolidation ---------------------------------------------------------

export type Verdict =
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
 * Les réponses qui comptent (premier tour, `compte` vrai) forment des séries de 3 questions différentes dans l'ordre :
 * une réponse qui ne compte pas est remplacée par la suivante, et une réponse à une question déjà dans la série en
 * cours ne compte pas pour la série (répéter la même question ne remplace pas les deux autres).
 * Une série valable suffit. Les séries se forment au fil des faits, sans jamais revenir sur une série finie ;
 * leur verdict ne se calcule qu'une fois la restitution finie, et une seule fois chacun.
 */
export class SuiviConsolidation {
  readonly #reglages: Reglages
  readonly #tranchages: Tranchages
  readonly #reserve: ReadonlySet<string>
  /** Le type de chaque étape ; si un identifiant se répète, la première étape l'emporte. */
  readonly #typeDeLEtape: ReadonlyMap<string, TypeEtape>
  readonly #dePremierTour = estCorrectionDe('consolidation')
  readonly #reponseDeRestitution = estCorrectionDe('restitution')
  #coursAvant = Number.NEGATIVE_INFINITY
  #comptees = 0
  #courante: Comptee[] = []
  /** Les séries finies dont le verdict n'est pas encore calculé. */
  readonly #enAttente: Comptee[][] = []
  #derniere: Verdict | undefined
  #valable: Verdict | undefined

  constructor(manifeste: Manifeste, reglages: Reglages, tranchages: Tranchages) {
    this.#reglages = reglages
    this.#tranchages = tranchages
    this.#reserve = new Set(manifeste.consolidation.map((question) => question.id))
    this.#typeDeLEtape = new Map(
      manifeste.etapes.toReversed().map((etape): [string, TypeEtape] => [etape.id, etape.type]),
    )
  }

  #ouvreLeCours(fait: Fait): boolean {
    if (fait.type !== 'etape_vue') return false
    const type = this.#typeDeLEtape.get(fait.etape)
    return type !== undefined && ETAPES_DE_COURS.has(type)
  }

  avancer(fait: Fait): void {
    if (
      this.#dePremierTour(fait) &&
      compteEffectif(this.#tranchages, fait) &&
      this.#reserve.has(fait.question)
    ) {
      this.#comptees += 1
      if (!this.#courante.some(({ correction }) => correction.question === fait.question)) {
        this.#courante.push({ correction: fait, coursAvant: this.#coursAvant })
        if (this.#courante.length === 3) {
          this.#enAttente.push(this.#courante)
          this.#courante = []
        }
      }
    }
    if (this.#reponseDeRestitution(fait) || this.#ouvreLeCours(fait)) {
      this.#coursAvant = Math.max(this.#coursAvant, instantEnMs(fait.date))
    }
  }

  /**
   * La première série valable ; à défaut, le verdict de la dernière ; `undefined` s'il n'y a pas encore
   * de série finie. `restitutionFinie` ne change pas d'un appel à l'autre : la restitution est vue une fois
   * pour toutes dès que chaque question a eu sa première réponse.
   */
  verdict(restitutionFinie: string): Verdict | undefined {
    if (this.#valable !== undefined) return this.#valable
    for (const trio of this.#enAttente) {
      this.#derniere = verdictSerie(this.#tranchages, trio, this.#reglages, restitutionFinie)
      if (this.#derniere.ok) {
        this.#valable = this.#derniere
        break
      }
    }
    this.#enAttente.length = 0
    return this.#derniere
  }

  /**
   * Le manque quand aucune série n'est finie : trop tôt tant que le délai court et qu'aucune réponse ne
   * compte, sinon à faire. Le délai court depuis la fin de la restitution ou, si une réponse de
   * restitution ou une étape de cours est venue depuis, depuis celle-ci : la même référence que pour
   * juger une série, sinon la consolidation s'ouvrirait pour une série jugée ensuite trop tôt.
   */
  sansSerie(restitutionFinie: string, maintenant: string): Verdict {
    const finDelai =
      Math.max(instantEnMs(restitutionFinie), this.#coursAvant) +
      this.#reglages.delaiConsolidationMinutes * MS_PAR_MINUTE
    return this.#comptees === 0 && instantEnMs(maintenant) < finDelai
      ? { ok: false, manque: { code: 'consolidation_trop_tot', apres: instantEnIso(finDelai) } }
      : { ok: false, manque: { code: 'consolidation_a_faire' } }
  }
}

/** Le verdict de la consolidation : elle ne se juge qu'une fois la restitution vue. */
export function consolidationDe(
  restitution: Restitution,
  suivi: SuiviConsolidation,
  maintenant: string,
): Verdict {
  if (!restitution.vu) {
    return {
      ok: false,
      manque: { code: 'restitution_incomplete', questions: restitution.manquantes },
    }
  }
  const verdict = suivi.verdict(restitution.date)
  if (verdict === undefined) return suivi.sansSerie(restitution.date, maintenant)
  // Une série faite trop tôt est perdue : le délai passé, une nouvelle série est à faire, et la
  // consolidation se rouvre pour la permettre.
  if (
    !verdict.ok &&
    verdict.manque.code === 'consolidation_trop_tot' &&
    verdict.manque.apres !== undefined &&
    instantEnMs(maintenant) >= instantEnMs(verdict.manque.apres)
  )
    return { ok: false, manque: { code: 'consolidation_a_faire' } }
  return verdict
}

// --- Pratique, atelier, aisance --------------------------------------------

interface Exercice {
  readonly id: string
  readonly reussite: number
  readonly items: ReadonlySet<string>
  /** Les items réussis à l'aide 0. */
  readonly reussis: Set<string>
  date: string | undefined
}

export interface ResultatPratique {
  readonly incompletes: readonly string[]
  readonly date: string | null
}

export class SuiviPratique {
  readonly #exercices: Exercice[]
  #connu: ResultatPratique | undefined

  constructor(manifeste: Manifeste) {
    this.#exercices = manifeste.pratique.map((exercice) => ({
      id: exercice.id,
      reussite: exercice.reussite,
      items: new Set(exercice.items.map((item) => item.id)),
      reussis: new Set<string>(),
      date: undefined,
    }))
  }

  avancer(fait: Fait): void {
    if (fait.type !== 'pratique_resultat' || !fait.reussi || fait.aide !== 0) return
    for (const exercice of this.#exercices) {
      if (exercice.date !== undefined || exercice.id !== fait.exercice) continue
      if (!exercice.items.has(fait.item)) continue
      exercice.reussis.add(fait.item)
      if (exercice.reussis.size >= exercice.reussite) {
        exercice.date = fait.date
        this.#connu = undefined
      }
    }
  }

  resultat(): ResultatPratique {
    this.#connu ??= {
      incompletes: this.#exercices.filter(({ date }) => date === undefined).map(({ id }) => id),
      date: plusTard(this.#exercices.flatMap(({ date }) => (date === undefined ? [] : [date]))),
    }
    return this.#connu
  }
}

/** Le premier résultat d'atelier réussi à l'aide 0, quand le manifeste en a un. */
export class SuiviAtelier {
  readonly #requis: boolean
  #date: string | null = null

  constructor(manifeste: Manifeste) {
    this.#requis = manifeste.atelier !== undefined
  }

  avancer(fait: Fait): void {
    if (
      this.#requis &&
      this.#date === null &&
      fait.type === 'atelier_resultat' &&
      fait.reussi &&
      fait.aide === 0
    ) {
      this.#date = fait.date
    }
  }

  resultat(): { readonly ok: boolean; readonly date: string | null } {
    return this.#requis ? { ok: this.#date !== null, date: this.#date } : { ok: true, date: null }
  }
}

/**
 * L'atteinte de la cible d'aisance : les paliers du manifeste, dans l'ordre. Une série réussie dans
 * le temps du palier courant le valide, un palier par jour au plus ; les autres séries sont de
 * l'entraînement. La cible est atteinte quand le dernier palier est validé.
 */
export class SuiviAisance {
  readonly #cible: Manifeste['aisance']
  readonly #reglages: Pick<Reglages, 'fuseau' | 'heureBascule'>
  #paliers = 0
  #dernierJour: string | null = null
  #date: string | null = null

  constructor(cible: Manifeste['aisance'], reglages: Pick<Reglages, 'fuseau' | 'heureBascule'>) {
    this.#cible = cible
    this.#reglages = reglages
  }

  avancer(fait: Fait): void {
    const cible = this.#cible
    if (cible === undefined) return
    // Plus de palier : la cible est atteinte, les séries suivantes sont de l'entraînement.
    const palier = cible.paliers_s[this.#paliers]
    if (palier === undefined) return
    if (fait.type !== 'aisance_resultat' || !fait.reussi || fait.dureeS > palier) return
    const jour = jourDe(fait.date, this.#reglages.fuseau, this.#reglages.heureBascule)
    if (jour === this.#dernierJour) return
    this.#dernierJour = jour
    this.#paliers += 1
    if (this.#paliers >= cible.paliers_s.length) this.#date = fait.date
  }

  /** Les paliers validés jusqu'ici. */
  get paliers(): number {
    return this.#paliers
  }

  resultat(): { readonly ok: boolean; readonly date: string | null } {
    return this.#cible === undefined
      ? { ok: true, date: null }
      : { ok: this.#date !== null, date: this.#date }
  }
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

/** Une réponse de restitution ou de consolidation du premier tour : seule elle peut fermer des erreurs. */
function peutFermerDesErreurs(fait: Fait): fait is Correction {
  return (
    fait.type === 'correction' &&
    (fait.serie === 'restitution' || fait.serie === 'consolidation') &&
    fait.tour === 1
  )
}

/** Une réponse ferme les erreurs de sa question quand elle compte et qu'elle est solide, tranchage compris. */
function fermeLesErreurs(tranchages: Tranchages, reponse: Correction): boolean {
  return compteEffectif(tranchages, reponse) && niveauEffectif(tranchages, reponse) === 'solide'
}

/** Ce qui est arrivé à une erreur. */
interface EvenementErreur {
  /** Le rang du fait dans l'ordre des faits. */
  readonly rang: number
  readonly ouvre: boolean
  /** Pour une fermeture par une réponse de restitution ou de consolidation : elle ne ferme que si cette réponse le fait. */
  readonly reponse: Correction | undefined
}

interface EtatErreur {
  ouverte: boolean
  /** Le rang du fait qui l'a ouverte, tant qu'elle l'est. */
  depuis: number
}

/**
 * Une erreur s'ouvre quand Amine la coche (l'IA seule n'ouvre rien) et se ferme quand il la décoche
 * ou qu'une réponse réussie, au premier tour et qui compte, touche la même erreur dans une série
 * de restitution ou de consolidation, ou dans une vérification retenue par `SuiviVerifications`
 * (valable, du bon genre et à l'heure : les autres sont ignorées). Le suivi des vérifications
 * avance d'un fait avant celui-ci : `verificationsRetenues` est à jour quand le fait arrive.
 *
 * Chaque erreur a sa propre histoire (ouverte, fermée, rouverte…), tenue à part : un tranchage qui change
 * si une réponse déjà lue ferme des erreurs ne fait relire que l'histoire de ces erreurs, pas tous les faits.
 */
export class SuiviErreurs {
  readonly #manifeste: Manifeste
  readonly #tranchages: Tranchages
  readonly #verificationsRetenues: ReadonlySet<string>
  readonly #histoires = new Map<string, EvenementErreur[]>()
  readonly #etats = new Map<string, EtatErreur>()
  #rang = 0
  #nombreOuvertes = 0
  #parQuestion: ReadonlyMap<string, readonly string[]> | undefined

  constructor(
    manifeste: Manifeste,
    tranchages: Tranchages,
    verificationsRetenues: ReadonlySet<string>,
  ) {
    this.#manifeste = manifeste
    this.#tranchages = tranchages
    this.#verificationsRetenues = verificationsRetenues
  }

  /** Combien d'erreurs sont ouvertes. */
  get nombreOuvertes(): number {
    return this.#nombreOuvertes
  }

  /** Les erreurs ouvertes, dans l'ordre où elles ont été ouvertes. */
  get ouvertes(): string[] {
    return [...this.#etats]
      .filter(([, etat]) => etat.ouverte)
      .sort(([, a], [, b]) => a.depuis - b.depuis)
      .map(([erreur]) => erreur)
  }

  #erreursDeLaQuestion(question: string): readonly string[] {
    this.#parQuestion ??= erreursParQuestion(this.#manifeste)
    return this.#parQuestion.get(question) ?? []
  }

  #histoireDe(erreur: string): EvenementErreur[] {
    let histoire = this.#histoires.get(erreur)
    if (histoire === undefined) {
      histoire = []
      this.#histoires.set(erreur, histoire)
    }
    return histoire
  }

  #etatDe(erreur: string): EtatErreur {
    let etat = this.#etats.get(erreur)
    if (etat === undefined) {
      etat = { ouverte: false, depuis: -1 }
      this.#etats.set(erreur, etat)
    }
    return etat
  }

  #ferme(reponse: Correction | undefined): boolean {
    return reponse === undefined || fermeLesErreurs(this.#tranchages, reponse)
  }

  #ouvrir(erreur: string, rang: number): void {
    this.#histoireDe(erreur).push({ rang, ouvre: true, reponse: undefined })
    const etat = this.#etatDe(erreur)
    if (!etat.ouverte) {
      etat.ouverte = true
      etat.depuis = rang
      this.#nombreOuvertes += 1
    }
  }

  #fermer(erreur: string, rang: number, reponse: Correction | undefined): void {
    this.#histoireDe(erreur).push({ rang, ouvre: false, reponse })
    const etat = this.#etatDe(erreur)
    if (etat.ouverte && this.#ferme(reponse)) {
      etat.ouverte = false
      this.#nombreOuvertes -= 1
    }
  }

  avancer(fait: Fait): void {
    const rang = this.#rang
    this.#rang += 1
    if (fait.type === 'erreur_cochee') this.#ouvrir(fait.erreur, rang)
    if (fait.type === 'erreur_decochee') this.#fermer(fait.erreur, rang, undefined)
    if (fait.type === 'erreur_ia_tranchee' && fait.decision === 'confirmee') {
      this.#ouvrir(fait.erreur, rang)
    }
    if (peutFermerDesErreurs(fait)) {
      for (const erreur of this.#erreursDeLaQuestion(fait.question)) {
        this.#fermer(erreur, rang, fait)
      }
    }
    if (fait.type === 'verification_terminee' && this.#verificationsRetenues.has(fait.id)) {
      for (const reponse of fait.reponses.filter(reponseReussie)) {
        for (const erreur of this.#erreursDeLaQuestion(reponse.question)) {
          this.#fermer(erreur, rang, undefined)
        }
      }
    }
  }

  /** Une réponse déjà lue a été tranchée : relit l'histoire des erreurs qu'elle touche. */
  revoir(reponse: Correction): void {
    for (const erreur of this.#erreursDeLaQuestion(reponse.question)) {
      const etat = this.#etatDe(erreur)
      const etaitOuverte = etat.ouverte
      etat.ouverte = false
      etat.depuis = -1
      for (const evenement of this.#histoireDe(erreur)) {
        if (evenement.ouvre) {
          if (!etat.ouverte) {
            etat.ouverte = true
            etat.depuis = evenement.rang
          }
        } else if (this.#ferme(evenement.reponse)) {
          etat.ouverte = false
        }
      }
      this.#nombreOuvertes += Number(etat.ouverte) - Number(etaitOuverte)
    }
  }
}

// --- Vérifications, retests ------------------------------------------------

/**
 * Chaque type de question que le type de contenu fait tirer (par défaut : explication, tâche et
 * transfert) réussi au premier tour et qui compte : explication et transfert au niveau solide.
 */
export function compositionReussie(
  reponses: readonly ReponseVerification[],
  parties: readonly TypeDifferee[] = reservesDuType(undefined).parties,
): boolean {
  return parties.every((type) =>
    reponses.some((reponse) => reponse.type === type && reponseReussie(reponse)),
  )
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
 * une réussite le remet à zéro. Il part de la date où le bloc est devenu « acquis provisoirement ».
 */
export class SuiviVerifications {
  readonly #provisoire: string
  readonly #reglages: Reglages
  palier: 'provisoire' | 'acquis' = 'provisoire'
  dateAcquis: string
  retest: string | null = null
  echecs = 0
  derniereReussite: string | null = null
  dernierEchec: string | null = null
  descendu = false
  reussitesDeRetest: string[] = []
  /** Les identifiants des vérifications que les règles retiennent. */
  readonly retenues = new Set<string>()
  /** La dernière réussite retenue : le point de départ de l'entretien suivant. */
  #derniere: string

  readonly #parties: readonly TypeDifferee[]

  constructor(provisoire: string, reglages: Reglages, parties: readonly TypeDifferee[]) {
    this.#provisoire = provisoire
    this.#reglages = reglages
    this.#parties = parties
    this.dateAcquis = provisoire
    this.#derniere = provisoire
  }

  avancer(fait: Fait): void {
    if (fait.type !== 'verification_terminee' || !fait.valable) return
    const reglages = this.#reglages
    const jour = (instant: string) => jourDe(instant, reglages.fuseau, reglages.heureBascule)
    const attendu =
      this.palier === 'provisoire' ? 'verification' : this.retest === null ? 'retest' : 'entretien'
    if (fait.verification !== attendu) return
    const verification = attendu === 'verification'
    const echeance = echeanceAttendue(
      attendu,
      { provisoire: this.#provisoire, dateAcquis: this.dateAcquis, derniere: this.#derniere },
      reglages,
      this.reussitesDeRetest.length,
    )
    if (echeance === null || jour(fait.date) < echeance) return
    this.retenues.add(fait.id)
    if (compositionReussie(fait.reponses, this.#parties)) {
      this.echecs = 0
      this.descendu = false
      this.derniereReussite = fait.date
      this.#derniere = fait.date
      this.dernierEchec = null
      if (verification) {
        this.palier = 'acquis'
        this.dateAcquis = fait.date
      } else {
        this.retest ??= fait.date
        this.reussitesDeRetest.push(fait.date)
      }
    } else {
      this.echecs += 1
      this.dernierEchec = fait.date
      if (this.echecs >= reglages.echecsAvantDescente && !verification) {
        this.echecs = 0
        this.descendu = true
        this.reussitesDeRetest = []
        if (this.retest === null) {
          this.palier = 'provisoire'
        } else {
          this.retest = null
        }
      }
    }
  }
}

/** Le premier transfert solide, au premier tour et qui compte, d'une vérification valable. */
export class SuiviTransfert {
  date: string | null = null

  avancer(fait: Fait): void {
    if (
      this.date === null &&
      fait.type === 'verification_terminee' &&
      fait.valable &&
      fait.reponses.some((reponse) => reponse.type === 'transfert' && reponseReussie(reponse))
    ) {
      this.date = fait.date
    }
  }
}

/** Le statut forcé en vigueur : le dernier forçage, à moins qu'il n'ait été levé. */
export class SuiviForcage {
  force: ResultatBloc['force'] = null

  avancer(fait: Fait): void {
    if (fait.type === 'statut_force') this.force = { statut: fait.statut, raison: fait.raison }
    if (fait.type === 'force_levee') this.force = null
  }
}

// --- Assemblage ------------------------------------------------------------

/** La date où le bloc devient « acquis provisoirement » : quand toutes ses conditions sont remplies, `null` sinon. */
export function provisoireDe(
  restitution: Restitution,
  consolidation: Verdict | undefined,
  pratique: ResultatPratique,
  atelier: { readonly ok: boolean; readonly date: string | null },
): string | null {
  return restitution.vu &&
    consolidation?.ok === true &&
    pratique.incompletes.length === 0 &&
    atelier.ok
    ? [pratique.date, atelier.date].reduce<string>(plusTardQue, consolidation.date)
    : null
}

/** Maîtrisé : acquis, retesté avec succès, et la cible d'aisance atteinte. Donne la date du retest, `null` sinon. */
function retestSiMaitrise(
  verifications: Pick<SuiviVerifications, 'palier' | 'retest'> | null,
  aisanceAtteinte: boolean,
): string | null {
  return verifications?.palier === 'acquis' && aisanceAtteinte ? verifications.retest : null
}

/** Le statut que disent les preuves et les erreurs ouvertes, sans tenir compte d'un forçage. */
export function statutCalculeDe(
  etat: {
    readonly vide: boolean
    readonly vu: boolean
    readonly verifications: Pick<SuiviVerifications, 'palier' | 'retest'> | null
    readonly aisanceAtteinte: boolean
  },
  erreursOuvertes: number,
): Statut {
  let statutDesPreuves: Statut = 'non_commence'
  if (!etat.vide) statutDesPreuves = 'en_cours'
  if (etat.vu) statutDesPreuves = 'vu'
  if (etat.verifications !== null) statutDesPreuves = 'acquis_provisoirement'
  if (etat.verifications?.palier === 'acquis') statutDesPreuves = 'acquis'
  if (retestSiMaitrise(etat.verifications, etat.aisanceAtteinte) !== null) {
    statutDesPreuves = 'maitrise'
  }
  return erreursOuvertes > 0 ? 'a_reprendre' : statutDesPreuves
}

/** Tout ce que les suivis ont établi sur un bloc, de quoi écrire son `ResultatBloc`. */
export interface Etapes {
  readonly vide: boolean
  readonly restitution: Restitution
  readonly consolidation: Verdict
  readonly pratique: ResultatPratique
  readonly atelier: { readonly ok: boolean; readonly date: string | null }
  readonly aisance: { readonly ok: boolean; readonly date: string | null }
  /** `null` tant que le bloc n'est pas « acquis provisoirement » : les vérifications ne comptent pas encore. */
  readonly verifications: SuiviVerifications | null
  readonly provisoire: string | null
  readonly erreursOuvertes: readonly string[]
  readonly transfert: string | null
  readonly force: ResultatBloc['force']
  readonly etapesVues: readonly string[]
}

export function assembler(
  etapes: Etapes,
  manifeste: Manifeste,
  reglages: Reglages,
  maintenant: string,
): ResultatBloc {
  const {
    restitution,
    consolidation,
    pratique,
    atelier,
    aisance,
    verifications,
    provisoire,
    erreursOuvertes,
    force,
  } = etapes
  const jour = (instant: string) => jourDe(instant, reglages.fuseau, reglages.heureBascule)
  const manque: Manque[] = []

  manque.push(...(consolidation.ok ? [] : [consolidation.manque]))
  if (restitution.vu && pratique.incompletes.length > 0) {
    manque.push({ code: 'pratique_aide', exercices: pratique.incompletes })
  }
  if (restitution.vu && !atelier.ok) manque.push({ code: 'atelier_manquant' })

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
  if (erreursOuvertes.length > 0) {
    manque.push({ code: 'erreur_ouverte', erreurs: [...erreursOuvertes] })
  }

  const statutCalcule = statutCalculeDe(
    {
      vide: etapes.vide,
      vu: restitution.vu,
      verifications,
      aisanceAtteinte: aisance.ok,
    },
    erreursOuvertes.length,
  )
  const retestMaitrise = retestSiMaitrise(verifications, aisance.ok)
  return {
    statut: force?.statut ?? statutCalcule,
    statutCalcule,
    force,
    dates: {
      vu: restitution.vu ? restitution.date : null,
      acquisProvisoirement: provisoire,
      acquis: verifications?.palier === 'acquis' ? verifications.dateAcquis : null,
      maitrise: retestMaitrise === null ? null : plusTardQue(retestMaitrise, aisance.date),
    },
    manque,
    erreursOuvertes: [...erreursOuvertes],
    echecsConsecutifs: verifications?.echecs ?? 0,
    descendu: verifications?.descendu ?? false,
    etapesVues: [...etapes.etapesVues],
    preuves: {
      consolidation: consolidation.ok ? consolidation.date : null,
      pratique:
        manifeste.pratique.length > 0 && pratique.incompletes.length === 0 ? pratique.date : null,
      atelier: atelier.date,
      transfert: etapes.transfert,
      aisance: aisance.date,
      aisanceRequise: manifeste.aisance !== undefined,
      derniereReussite: verifications?.derniereReussite ?? null,
      reussitesDeRetest: [...(verifications?.reussitesDeRetest ?? [])],
      dernierEchec: verifications?.dernierEchec ?? null,
    },
  }
}

// --- L'état d'un bloc ------------------------------------------------------

/** Tous les suivis d'un bloc, à jour des faits qu'ils ont lus. */
export interface EtatBloc {
  readonly manifeste: Manifeste
  readonly reglages: Reglages
  /** Le dernier tranchage de chaque correction, les tranchages qui n'ont pas encore leur correction compris. */
  readonly tranchages: Map<string, TranchageCorrection>
  /** Les corrections lues, par identifiant. */
  readonly corrections: Map<string, Correction>
  readonly restitution: SuiviRestitution
  readonly consolidation: SuiviConsolidation
  readonly pratique: SuiviPratique
  readonly atelier: SuiviAtelier
  readonly aisance: SuiviAisance
  readonly transfert: SuiviTransfert
  readonly forcage: SuiviForcage
  /** Les étapes affichées, dans l'ordre de leur première vue. */
  readonly etapesVues: Set<string>
  /** Le nombre de faits lus. */
  faits: number
  /** Les vérifications et les erreurs ne se lisent qu'avec la date d'« acquis provisoirement » : elles repartent d'elle. */
  provisoire: string | null
  verifications: SuiviVerifications | null
  erreurs: SuiviErreurs
}

/** Fait lire un fait à tous les suivis qui n'ont pas besoin de la date d'« acquis provisoirement ». */
export function lirePreuves(etat: EtatBloc, fait: Fait): void {
  etat.faits += 1
  if (fait.type === 'correction') etat.corrections.set(fait.id, fait)
  if (fait.type === 'etape_vue') etat.etapesVues.add(fait.etape)
  if (fait.type === 'fiche_recommencee') etat.etapesVues.clear()
  etat.restitution.avancer(fait)
  etat.consolidation.avancer(fait)
  etat.pratique.avancer(fait)
  etat.atelier.avancer(fait)
  etat.aisance.avancer(fait)
  etat.transfert.avancer(fait)
  etat.forcage.avancer(fait)
}

/** La date d'« acquis provisoirement » d'après les preuves lues jusque-là. */
export function provisoireDeLEtat(etat: EtatBloc): string | null {
  const restitution = etat.restitution.resultat()
  return provisoireDe(
    restitution,
    restitution.vu ? etat.consolidation.verdict(restitution.date) : undefined,
    etat.pratique.resultat(),
    etat.atelier.resultat(),
  )
}

/** Fait lire un fait aux suivis qui partent de la date d'« acquis provisoirement » : les vérifications d'abord, les erreurs ensuite. */
export function lireVerifications(etat: EtatBloc, fait: Fait): void {
  etat.verifications?.avancer(fait)
  etat.erreurs.avancer(fait)
}

/** Repart de zéro pour les vérifications et les erreurs, en relisant `ordonnes` depuis le début. */
export function relireVerifications(
  etat: EtatBloc,
  ordonnes: readonly Fait[],
  provisoire: string | null,
): void {
  etat.provisoire = provisoire
  etat.verifications =
    provisoire === null
      ? null
      : new SuiviVerifications(
          provisoire,
          etat.reglages,
          reservesDuType(etat.manifeste.type).parties,
        )
  etat.erreurs = new SuiviErreurs(
    etat.manifeste,
    etat.tranchages,
    etat.verifications?.retenues ?? new Set<string>(),
  )
  for (const fait of ordonnes) lireVerifications(etat, fait)
}

/** L'état d'un bloc après avoir lu `ordonnes` : ses faits triés par date puis identifiant, sans doublon d'identifiant. */
export function construireEtat(
  ordonnes: readonly Fait[],
  manifeste: Manifeste,
  reglages: Reglages,
): EtatBloc {
  const tranchages = tranchagesDe(ordonnes)
  const etat: EtatBloc = {
    manifeste,
    reglages,
    tranchages,
    corrections: new Map(),
    restitution: new SuiviRestitution(manifeste),
    consolidation: new SuiviConsolidation(manifeste, reglages, tranchages),
    pratique: new SuiviPratique(manifeste),
    atelier: new SuiviAtelier(manifeste),
    aisance: new SuiviAisance(manifeste.aisance, reglages),
    transfert: new SuiviTransfert(),
    forcage: new SuiviForcage(),
    etapesVues: new Set<string>(),
    faits: 0,
    provisoire: null,
    verifications: null,
    erreurs: new SuiviErreurs(manifeste, tranchages, new Set<string>()),
  }
  for (const fait of ordonnes) lirePreuves(etat, fait)
  relireVerifications(etat, ordonnes, provisoireDeLEtat(etat))
  return etat
}

/** Ce que les règles lisent d'une correction tranchée : de quoi dire si un tranchage change quelque chose. */
interface LectureTranchee {
  /** Le compte et le niveau des réponses de consolidation du premier tour. */
  readonly consolidation: string
  /** Vrai si une réponse de restitution ou de consolidation du premier tour ferme les erreurs de sa question. */
  readonly ferme: boolean
}

const RIEN_A_LIRE: LectureTranchee = { consolidation: '', ferme: false }

/** Une correction tranchée telle que les règles la lisent ; `undefined` : la correction n'est pas (encore) là. */
export function lectureTranchee(
  tranchages: Tranchages,
  correction: Correction | undefined,
): LectureTranchee {
  if (correction === undefined || correction.tour !== 1) return RIEN_A_LIRE
  return {
    consolidation:
      correction.serie === 'consolidation'
        ? `${String(compteEffectif(tranchages, correction))}|${niveauEffectif(tranchages, correction)}`
        : '',
    ferme: peutFermerDesErreurs(correction) && fermeLesErreurs(tranchages, correction),
  }
}

/** Le statut calculé d'après l'état, sans construire le `ResultatBloc` : ce qu'il faut pour suivre un bloc fait après fait. */
export function statutCalculeDeLEtat(etat: EtatBloc): Statut {
  return statutCalculeDe(
    {
      vide: etat.faits === 0,
      vu: etat.restitution.resultat().vu,
      verifications: etat.verifications,
      aisanceAtteinte: etat.aisance.resultat().ok,
    },
    etat.erreurs.nombreOuvertes,
  )
}

/** Ce que les suivis ont établi, `maintenant` ne servant qu'à dire ce qui manque. */
export function etapesDe(etat: EtatBloc, maintenant: string): Etapes {
  const restitution = etat.restitution.resultat()
  return {
    vide: etat.faits === 0,
    restitution,
    consolidation: consolidationDe(restitution, etat.consolidation, maintenant),
    pratique: etat.pratique.resultat(),
    atelier: etat.atelier.resultat(),
    aisance: etat.aisance.resultat(),
    verifications: etat.verifications,
    provisoire: etat.provisoire,
    erreursOuvertes: etat.erreurs.ouvertes,
    transfert: etat.transfert.date,
    force: etat.forcage.force,
    etapesVues: [...etat.etapesVues],
  }
}
