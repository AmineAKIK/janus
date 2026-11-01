import { RejeuAtelier, RejeuPratique, reservesDuType } from '@janus/contrats'
import type {
  CodeManque,
  ConstatAtelier,
  EssaiPratique,
  Manifeste,
  Reglages,
  Statut,
  TypeDifferee,
} from '@janus/contrats'
import type { Fait, ReponseVerification } from './faits.ts'
import { ajouterJours, instantEnMs, jourDe } from './temps.ts'
import type { Jour } from './temps.ts'

// Les règles du statut d'un bloc, une par « suivi » : chaque suivi lit les faits un à un, dans l'ordre
// (date puis identifiant, sans doublon), et sait dire où il en est à tout moment. `calculerBloc` les
// nourrit avec tous les faits d'un coup ; `SuiviBloc` les nourrit au fil de l'eau, pour que le statut après
// chaque fait ne coûte pas un recalcul complet.

export type { CodeManque }

/** Un manque et ses paramètres : questions, exercices ou erreurs concernés, jour à partir duquel c'est possible. */
export interface Manque {
  readonly code: CodeManque
  readonly questions?: readonly string[]
  readonly exercices?: readonly string[]
  readonly erreurs?: readonly string[]
  /** Le jour `AAAA-MM-JJ` (vérification, retest) à partir duquel c'est possible. */
  readonly apres?: string
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
  /** Vrai quand le bloc a été mis à reprendre après des relances ratées et n'a pas retrouvé « acquis » depuis. */
  readonly descendu: boolean
  /** Les étapes de la fiche déjà affichées (`etape_vue`), dans l'ordre de leur première vue. */
  readonly etapesVues: readonly string[]
  /**
   * La pratique telle que la page la relit (`suivreLaPratique`) : le jour de l'appli, les résultats
   * depuis la fiche recommencée, les items expliqués et les constats d'atelier (`suivreLAtelier`).
   */
  readonly pratique: {
    readonly aujourdhui: Jour
    readonly essais: readonly EssaiPratique[]
    readonly expliques: readonly string[]
    readonly constats: readonly ConstatAtelier[]
  }
  /** Les dates qui alimentent le panneau « Cinq preuves » ; la file du jour s'en sert aussi pour les échéances. */
  readonly preuves: {
    /** Première explication solide, au premier tour et qui compte, d'une vérification valable. */
    readonly explication: string | null
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

// --- Pratique, atelier, aisance --------------------------------------------

interface Exercice {
  readonly id: string
  readonly reussite: number
  readonly items: ReadonlySet<string>
}

export interface ResultatPratique {
  readonly incompletes: readonly string[]
  readonly date: string | null
  /** Les résultats depuis la fiche recommencée, dans l'ordre : la page en relit ses items. */
  readonly essais: readonly EssaiPratique[]
  /** Les items dont l'explication déclarée est Solide et compte. */
  readonly expliques: readonly string[]
}

/**
 * Un exercice de pratique est fini quand `reussite` de ses items sont réussis à l'aide 0, l'aide que
 * l'item garde comprise (`RejeuPratique`, la règle que la page applique aussi). Un item qui
 * demande une explication (`explication` du manifeste) n'est réussi qu'avec, en plus, une explication
 * jugée Solide qui compte (après le tranchage d'Amine, s'il y en a un) : il l'est à la plus tardive
 * des deux dates.
 */
export class SuiviPratique {
  readonly #exercices: readonly Exercice[]
  /** L'item de chaque clé d'explication du manifeste. */
  readonly #itemDeLExplication: ReadonlyMap<string, string>
  /** La première réussite à l'aide 0 de chaque item, par exercice. */
  readonly #reussites = new Map<string, Map<string, string>>()
  /** Les corrections d'explication de chaque item. */
  readonly #explications = new Map<string, Correction[]>()
  readonly #tranchages = new Map<string, TranchageCorrection>()
  readonly #reglages: Pick<Reglages, 'fuseau' | 'heureBascule'>
  readonly #rejeu = new RejeuPratique()
  /** Les résultats depuis la fiche recommencée. */
  #essais: EssaiPratique[] = []
  #connu: ResultatPratique | undefined

  constructor(manifeste: Manifeste, reglages: Pick<Reglages, 'fuseau' | 'heureBascule'>) {
    this.#reglages = reglages
    this.#exercices = manifeste.pratique.map((exercice) => ({
      id: exercice.id,
      reussite: exercice.reussite,
      items: new Set(exercice.items.map((item) => item.id)),
    }))
    this.#itemDeLExplication = new Map(manifeste.explication.map(({ id, item }) => [id, item]))
  }

  avancer(fait: Fait): void {
    if (fait.type === 'pratique_resultat') {
      const essai: EssaiPratique = {
        id: fait.id,
        item: fait.item,
        reussi: fait.reussi,
        aide: fait.aide,
        brute: fait.brute === true,
        jour: jourDe(fait.date, this.#reglages.fuseau, this.#reglages.heureBascule),
        cas: fait.cas ?? null,
      }
      const aide = this.#rejeu.noter(essai)
      this.#essais.push(essai)
      this.#connu = undefined
      const reussites = this.#reussites.get(fait.exercice) ?? new Map<string, string>()
      if (fait.reussi && aide === 0 && !reussites.has(fait.item)) {
        reussites.set(fait.item, fait.date)
        this.#reussites.set(fait.exercice, reussites)
      }
    } else if (fait.type === 'fiche_recommencee') {
      // La page repart de zéro : plus d'aide gardée, et ses items se relisent depuis ici.
      this.#rejeu.couper()
      this.#essais = []
      this.#connu = undefined
    } else if (fait.type === 'correction' && fait.serie === 'explication') {
      const item = this.#itemDeLExplication.get(fait.question)
      if (item === undefined) return
      this.#explications.set(item, [...(this.#explications.get(item) ?? []), fait])
      this.#connu = undefined
    } else if (fait.type === 'correction_tranchee') {
      this.#tranchages.set(fait.correction, fait)
      this.#connu = undefined
    }
  }

  /** La date où l'item est expliqué, `undefined` s'il ne l'est pas ; `null` s'il n'a rien à expliquer. */
  #expliqueLe(item: string): string | null | undefined {
    if (![...this.#itemDeLExplication.values()].includes(item)) return null
    return (
      plusTard(
        (this.#explications.get(item) ?? [])
          .filter(
            (correction) =>
              compteEffectif(this.#tranchages, correction) &&
              niveauEffectif(this.#tranchages, correction) === 'solide',
          )
          .slice(0, 1)
          .map(({ date }) => date),
      ) ?? undefined
    )
  }

  #finiLe(exercice: Exercice): string | undefined {
    const dates = [...(this.#reussites.get(exercice.id) ?? [])]
      .filter(([item]) => exercice.items.has(item))
      .flatMap(([item, date]) => {
        const explique = this.#expliqueLe(item)
        if (explique === undefined) return []
        return [explique === null ? date : plusTardQue(date, explique)]
      })
      .sort((a, b) => instantEnMs(a) - instantEnMs(b))
    return dates[exercice.reussite - 1]
  }

  resultat(): ResultatPratique {
    if (this.#connu === undefined) {
      const fins = this.#exercices.map((exercice) => ({
        id: exercice.id,
        date: this.#finiLe(exercice),
      }))
      this.#connu = {
        incompletes: fins.filter(({ date }) => date === undefined).map(({ id }) => id),
        date: plusTard(fins.flatMap(({ date }) => (date === undefined ? [] : [date]))),
        essais: [...this.#essais],
        expliques: [...new Set(this.#itemDeLExplication.values())].filter(
          (item) => this.#expliqueLe(item) !== undefined,
        ),
      }
    }
    return this.#connu
  }
}

export interface ResultatAtelier {
  readonly ok: boolean
  readonly date: string | null
  /** Les constats lus, dans l'ordre : la page en relit l'atelier (`suivreLAtelier`). */
  readonly constats: readonly ConstatAtelier[]
}

/**
 * Le premier constat d'atelier réussi à l'aide 0, l'aide gardée du jour comprise (`RejeuAtelier`, la
 * règle que la page applique aussi), quand le manifeste a un atelier.
 */
export class SuiviAtelier {
  readonly #requis: boolean
  readonly #reglages: Pick<Reglages, 'fuseau' | 'heureBascule'>
  readonly #rejeu = new RejeuAtelier()
  readonly #constats: ConstatAtelier[] = []
  #date: string | null = null

  constructor(manifeste: Manifeste, reglages: Pick<Reglages, 'fuseau' | 'heureBascule'>) {
    this.#requis = manifeste.atelier !== undefined
    this.#reglages = reglages
  }

  avancer(fait: Fait): void {
    if (!this.#requis || fait.type !== 'atelier_resultat') return
    const constat: ConstatAtelier = {
      id: fait.id,
      reussi: fait.reussi,
      aide: fait.aide,
      jour: jourDe(fait.date, this.#reglages.fuseau, this.#reglages.heureBascule),
    }
    const aide = this.#rejeu.noter(constat)
    this.#constats.push(constat)
    if (this.#date === null && fait.reussi && aide === 0) this.#date = fait.date
  }

  resultat(): ResultatAtelier {
    return this.#requis
      ? { ok: this.#date !== null, date: this.#date, constats: [...this.#constats] }
      : { ok: true, date: null, constats: [] }
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
  const toutes = [...manifeste.restitution, ...manifeste.rappel, ...manifeste.differees]
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
 * Une réponse de restitution du premier tour : seule elle peut fermer des erreurs. Les réponses de
 * consolidation enregistrées avant la fin de cette série le peuvent encore.
 */
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
  /** Pour une fermeture par une réponse de restitution : elle ne ferme que si cette réponse le fait. */
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
 * de restitution, ou dans une vérification retenue par `SuiviVerifications`
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
 * Le premier jour où la relance attendue peut être faite : la vérification `delaiVerificationJours`
 * jours après « acquis provisoirement », le retest `delaiRetestJours` jours après « acquis ».
 */
function echeanceAttendue(
  attendu: 'verification' | 'retest',
  dates: { provisoire: string; dateAcquis: string },
  reglages: Reglages,
): Jour {
  const jour = (instant: string) => jourDe(instant, reglages.fuseau, reglages.heureBascule)
  return attendu === 'verification'
    ? ajouterJours(jour(dates.provisoire), reglages.delaiVerificationJours)
    : ajouterJours(jour(dates.dateAcquis), reglages.delaiRetestJours)
}

/**
 * Parcourt les vérifications valables, dans l'ordre, à partir de la date où le bloc est devenu
 * « acquis provisoirement ». Deux relances : la vérification, qui donne « acquis », puis le retest,
 * qui clôt le parcours ; une relance d'un autre type, ou faite avant son délai, est ignorée. Un
 * échec compte ; `echecsAvantDescente` échecs de suite mettent le bloc à reprendre (`reprise`) :
 * restitution et pratique sont à refaire, et le suivi ne lit plus rien. Une réussite remet le
 * compteur à zéro.
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
  /** La date de la relance ratée qui a mis le bloc à reprendre ; `null` tant que ce n'est pas arrivé. */
  reprise: string | null = null
  reussitesDeRetest: string[] = []
  /** Les identifiants des vérifications que les règles retiennent. */
  readonly retenues = new Set<string>()

  readonly #parties: readonly TypeDifferee[]

  constructor(provisoire: string, reglages: Reglages, parties: readonly TypeDifferee[]) {
    this.#provisoire = provisoire
    this.#reglages = reglages
    this.#parties = parties
    this.dateAcquis = provisoire
  }

  avancer(fait: Fait): void {
    if (fait.type !== 'verification_terminee' || !fait.valable || this.reprise !== null) return
    const reglages = this.#reglages
    const jour = (instant: string) => jourDe(instant, reglages.fuseau, reglages.heureBascule)
    if (this.retest !== null) return
    const attendu = this.palier === 'provisoire' ? 'verification' : 'retest'
    if (fait.verification !== attendu) return
    const echeance = echeanceAttendue(
      attendu,
      { provisoire: this.#provisoire, dateAcquis: this.dateAcquis },
      reglages,
    )
    if (jour(fait.date) < echeance) return
    this.retenues.add(fait.id)
    if (compositionReussie(fait.reponses, this.#parties)) {
      this.echecs = 0
      this.derniereReussite = fait.date
      this.dernierEchec = null
      if (attendu === 'verification') {
        this.palier = 'acquis'
        this.dateAcquis = fait.date
      } else {
        this.retest = fait.date
        this.reussitesDeRetest.push(fait.date)
      }
    } else {
      this.echecs += 1
      this.dernierEchec = fait.date
      if (this.echecs >= reglages.echecsAvantDescente) this.reprise = fait.date
    }
  }
}

/**
 * La première réponse réussie d'un type (explication, transfert), au premier tour et qui compte, dans
 * une vérification valable : la preuve « comprendre » ou « transférer » des Cinq preuves.
 */
export class SuiviPartie {
  readonly #type: TypeDifferee
  date: string | null = null

  constructor(type: TypeDifferee) {
    this.#type = type
  }

  avancer(fait: Fait): void {
    if (
      this.date === null &&
      fait.type === 'verification_terminee' &&
      fait.valable &&
      fait.reponses.some((reponse) => reponse.type === this.#type && reponseReussie(reponse))
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

/**
 * La date où le bloc devient « acquis provisoirement » : restitution faite, pratique à l'aide 0 et
 * atelier réussi, `null` sinon. La compréhension se prouve à la vérification, trois jours plus tard.
 */
export function provisoireDe(
  restitution: Restitution,
  pratique: ResultatPratique,
  atelier: { readonly ok: boolean; readonly date: string | null },
): string | null {
  return restitution.vu && pratique.incompletes.length === 0 && atelier.ok
    ? [pratique.date, atelier.date].reduce<string>(plusTardQue, restitution.date)
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
    /** Vrai après `echecsAvantDescente` relances ratées de suite, tant que restitution et pratique ne sont pas refaites. */
    readonly enReprise: boolean
  },
  erreursOuvertes: number,
): Statut {
  let statutDesPreuves: Statut = 'non_commence'
  if (!etat.vide) statutDesPreuves = 'en_cours'
  if (etat.vu) statutDesPreuves = 'vu'
  if (etat.enReprise && etat.verifications === null) statutDesPreuves = 'a_reprendre'
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
  readonly pratique: ResultatPratique
  readonly atelier: ResultatAtelier
  readonly aisance: { readonly ok: boolean; readonly date: string | null }
  /** `null` tant que le bloc n'est pas « acquis provisoirement » : les vérifications ne comptent pas encore. */
  readonly verifications: SuiviVerifications | null
  readonly provisoire: string | null
  readonly erreursOuvertes: readonly string[]
  readonly explication: string | null
  readonly transfert: string | null
  readonly force: ResultatBloc['force']
  readonly etapesVues: readonly string[]
  /** La date de la dernière mise à reprendre, `null` s'il n'y en a jamais eu : les preuves d'avant ne comptent plus. */
  readonly reprise: string | null
}

export function assembler(
  etapes: Etapes,
  manifeste: Manifeste,
  reglages: Reglages,
  maintenant: string,
): ResultatBloc {
  const {
    restitution,
    pratique,
    atelier,
    aisance,
    verifications,
    provisoire,
    erreursOuvertes,
    force,
    reprise,
  } = etapes
  const jour = (instant: string) => jourDe(instant, reglages.fuseau, reglages.heureBascule)
  const manque: Manque[] = []

  if (reprise !== null && verifications === null) {
    manque.push({
      code: 'reprise_a_faire',
      questions: restitution.vu ? [] : [...restitution.manquantes],
      exercices: [...pratique.incompletes],
    })
  }

  if (!restitution.vu) {
    manque.push({ code: 'restitution_incomplete', questions: [...restitution.manquantes] })
  }
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
      enReprise: reprise !== null,
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
    descendu: reprise !== null && verifications?.palier !== 'acquis',
    etapesVues: [...etapes.etapesVues],
    pratique: {
      aujourdhui: jour(maintenant),
      essais: pratique.essais,
      expliques: pratique.expliques,
      constats: atelier.constats,
    },
    preuves: {
      explication: etapes.explication,
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
  readonly pratique: SuiviPratique
  readonly atelier: SuiviAtelier
  readonly aisance: SuiviAisance
  readonly explication: SuiviPartie
  readonly transfert: SuiviPartie
  readonly forcage: SuiviForcage
  /** Les étapes affichées, dans l'ordre de leur première vue. */
  readonly etapesVues: Set<string>
  /** Le nombre de faits lus. */
  faits: number
  /** Les vérifications et les erreurs ne se lisent qu'avec la date d'« acquis provisoirement » : elles repartent d'elle. */
  provisoire: string | null
  verifications: SuiviVerifications | null
  erreurs: SuiviErreurs
  /**
   * La date de la dernière mise à reprendre : restitution, pratique et atelier ne lisent que les
   * faits qui la suivent, le bloc se reprouve. `null` tant qu'il n'y en a pas eu.
   */
  reprise: string | null
}

/** Fait lire un fait à tous les suivis qui n'ont pas besoin de la date d'« acquis provisoirement ». */
export function lirePreuves(etat: EtatBloc, fait: Fait): void {
  etat.faits += 1
  if (fait.type === 'correction') etat.corrections.set(fait.id, fait)
  if (fait.type === 'etape_vue') etat.etapesVues.add(fait.etape)
  if (fait.type === 'fiche_recommencee') etat.etapesVues.clear()
  if (etat.reprise === null || instantEnMs(fait.date) > instantEnMs(etat.reprise)) {
    etat.restitution.avancer(fait)
    etat.pratique.avancer(fait)
    etat.atelier.avancer(fait)
  }
  etat.aisance.avancer(fait)
  etat.explication.avancer(fait)
  etat.transfert.avancer(fait)
  etat.forcage.avancer(fait)
}

/** La date d'« acquis provisoirement » d'après les preuves lues jusque-là. */
export function provisoireDeLEtat(etat: EtatBloc): string | null {
  return provisoireDe(
    etat.restitution.resultat(),
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
  reprise: string | null = null,
): EtatBloc {
  const tranchages = tranchagesDe(ordonnes)
  const etat: EtatBloc = {
    manifeste,
    reglages,
    tranchages,
    corrections: new Map(),
    restitution: new SuiviRestitution(manifeste),
    pratique: new SuiviPratique(manifeste, reglages),
    atelier: new SuiviAtelier(manifeste, reglages),
    aisance: new SuiviAisance(manifeste.aisance, reglages),
    explication: new SuiviPartie('explication'),
    transfert: new SuiviPartie('transfert'),
    forcage: new SuiviForcage(),
    etapesVues: new Set<string>(),
    faits: 0,
    provisoire: null,
    verifications: null,
    erreurs: new SuiviErreurs(manifeste, tranchages, new Set<string>()),
    reprise,
  }
  for (const fait of ordonnes) lirePreuves(etat, fait)
  relireVerifications(etat, ordonnes, provisoireDeLEtat(etat))
  // Une mise à reprendre : le bloc se reprouve avec les seuls faits qui la suivent.
  const nouvelle = etat.verifications?.reprise ?? null
  return nouvelle === null ? etat : construireEtat(ordonnes, manifeste, reglages, nouvelle)
}

/** Ce que les règles lisent d'une correction tranchée : de quoi dire si un tranchage change quelque chose. */
interface LectureTranchee {
  /** Vrai si une réponse de restitution du premier tour ferme les erreurs de sa question. */
  readonly ferme: boolean
}

const RIEN_A_LIRE: LectureTranchee = { ferme: false }

/** Une correction tranchée telle que les règles la lisent ; `undefined` : la correction n'est pas (encore) là. */
export function lectureTranchee(
  tranchages: Tranchages,
  correction: Correction | undefined,
): LectureTranchee {
  if (correction === undefined || correction.tour !== 1) return RIEN_A_LIRE
  return { ferme: peutFermerDesErreurs(correction) && fermeLesErreurs(tranchages, correction) }
}

/** Le statut calculé d'après l'état, sans construire le `ResultatBloc` : ce qu'il faut pour suivre un bloc fait après fait. */
export function statutCalculeDeLEtat(etat: EtatBloc): Statut {
  return statutCalculeDe(
    {
      vide: etat.faits === 0,
      vu: etat.restitution.resultat().vu,
      verifications: etat.verifications,
      aisanceAtteinte: etat.aisance.resultat().ok,
      enReprise: etat.reprise !== null,
    },
    etat.erreurs.nombreOuvertes,
  )
}

/** Ce que les suivis ont établi sur le bloc. */
export function etapesDe(etat: EtatBloc): Etapes {
  const restitution = etat.restitution.resultat()
  return {
    vide: etat.faits === 0,
    restitution,
    pratique: etat.pratique.resultat(),
    atelier: etat.atelier.resultat(),
    aisance: etat.aisance.resultat(),
    verifications: etat.verifications,
    provisoire: etat.provisoire,
    erreursOuvertes: etat.erreurs.ouvertes,
    explication: etat.explication.date,
    transfert: etat.transfert.date,
    force: etat.forcage.force,
    etapesVues: [...etat.etapesVues],
    reprise: etat.reprise,
  }
}
