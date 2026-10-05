import type { NoteCarte, Reglages } from '@janus/contrats'
import { createEmptyCard, fsrs, generatorParameters, Rating } from 'ts-fsrs'
import type { Card, CardInput, State } from 'ts-fsrs'
import { echeances } from './echeances.ts'
import type { Echeance } from './echeances.ts'
import type { ResultatBloc } from './statut.ts'
import { comparer } from './ordre.ts'
import { instantEnMs } from './temps.ts'

/**
 * L'état d'une carte pour FSRS, tel qu'on le range : les dates sont des instants ISO.
 * `state` : 0 nouvelle, 1 apprentissage, 2 révision, 3 réapprentissage.
 */
export interface EtatCarte {
  readonly due: string
  readonly stability: number
  readonly difficulty: number
  readonly scheduledDays: number
  readonly learningSteps: number
  readonly reps: number
  readonly lapses: number
  readonly state: State
  readonly lastReview: string | null
}

const NOTES: Record<NoteCarte, Rating.Again | Rating.Hard | Rating.Good | Rating.Easy> = {
  a_revoir: Rating.Again,
  difficile: Rating.Hard,
  bien: Rating.Good,
  facile: Rating.Easy,
}

/** FSRS sans variation aléatoire : le même historique donne toujours les mêmes dates. */
function planificateur(reglages: Reglages) {
  return fsrs(
    generatorParameters({ request_retention: reglages.retentionVisee, enable_fuzz: false }),
  )
}

function depuis(carte: Card): EtatCarte {
  return {
    due: carte.due.toISOString(),
    stability: carte.stability,
    difficulty: carte.difficulty,
    scheduledDays: carte.scheduled_days,
    learningSteps: carte.learning_steps,
    reps: carte.reps,
    lapses: carte.lapses,
    state: carte.state,
    lastReview: carte.last_review === undefined ? null : carte.last_review.toISOString(),
  }
}

/** Une carte jamais révisée, due à `maintenant`. */
export function carteNeuve(maintenant: string): EtatCarte {
  return depuis(createEmptyCard(maintenant))
}

/** L'état de la carte après la note d'Amine, avec la rétention visée des réglages. */
export function noterCarte(
  etat: EtatCarte,
  note: NoteCarte,
  maintenant: string,
  reglages: Reglages,
): EtatCarte {
  const carte: CardInput = {
    due: etat.due,
    stability: etat.stability,
    difficulty: etat.difficulty,
    elapsed_days: 0,
    scheduled_days: etat.scheduledDays,
    learning_steps: etat.learningSteps,
    reps: etat.reps,
    lapses: etat.lapses,
    state: etat.state,
    last_review: etat.lastReview,
  }
  return depuis(planificateur(reglages).next(carte, maintenant, NOTES[note]).card)
}

/** Vrai quand la carte est due à `maintenant`. */
export function carteDue(etat: EtatCarte, maintenant: string): boolean {
  return instantEnMs(etat.due) <= instantEnMs(maintenant)
}

export interface CarteDuBloc {
  readonly id: string
  readonly bloc: string
  /** `null` pour une carte jamais vue. */
  readonly etat: EtatCarte | null
}

export interface EntreeCartesDuJour {
  readonly cartes: readonly CarteDuBloc[]
  /** Les blocs au moins « vus » : leurs cartes sont dans la file. */
  readonly blocsVus: readonly string[]
  /** Nouvelles cartes déjà vues pour la première fois aujourd'hui. */
  readonly nouvellesDejaIntroduites: number
  readonly maintenant: string
  readonly reglages: Reglages
}

/**
 * Les cartes à faire : toutes les cartes dues, sans limite (de la plus en retard à la moins en
 * retard), et des nouvelles cartes jusqu'à `nouvellesCartesParJour` pour la journée.
 */
export function cartesDuJour(entree: EntreeCartesDuJour): { dues: string[]; nouvelles: string[] } {
  const { cartes, blocsVus, nouvellesDejaIntroduites, maintenant, reglages } = entree
  const visibles = cartes.filter(({ bloc }) => blocsVus.includes(bloc))
  const dues = visibles
    .flatMap(({ id, etat }) => (etat !== null && carteDue(etat, maintenant) ? [{ id, etat }] : []))
    .sort((a, b) => instantEnMs(a.etat.due) - instantEnMs(b.etat.due) || comparer(a.id, b.id))
    .map(({ id }) => id)
  const places = Math.max(0, reglages.nouvellesCartesParJour - nouvellesDejaIntroduites)
  const nouvelles = visibles
    .filter(({ etat }) => etat === null)
    .slice(0, places)
    .map(({ id }) => id)
  return { dues, nouvelles }
}

/** Une preuve : la date où elle a été faite, ou `null` tant qu'elle ne l'est pas. */
export type Preuve = { readonly date: string } | null

/** Le panneau « Cinq preuves » : comprendre, faire seul, transférer, retenir, aisance. */
export interface CinqPreuves {
  /** Date de la série de consolidation réussie. */
  readonly comprendre: Preuve
  /** Date où tous les exercices de pratique ont atteint leur règle à l'aide 0. */
  readonly faireSeul: Preuve
  /** Date du premier transfert solide qui compte. */
  readonly transferer: Preuve
  /** Date de la dernière vérification ou du dernier retest réussi, et la prochaine échéance. */
  readonly retenir: { readonly date: string; readonly prochaine: Echeance | null } | null
  /** Date où la cible est atteinte, ou `non_requis` si le manifeste n'en a pas. */
  readonly aisance: Preuve | 'non_requis'
}

const preuve = (date: string | null): Preuve => (date === null ? null : { date })

export function preuvesDuBloc(etat: ResultatBloc, reglages: Reglages): CinqPreuves {
  const { preuves } = etat
  return {
    comprendre: preuve(preuves.consolidation),
    faireSeul: preuve(preuves.pratique),
    transferer: preuve(preuves.transfert),
    retenir:
      preuves.derniereReussite === null
        ? null
        : { date: preuves.derniereReussite, prochaine: echeances(etat, reglages) },
    aisance: preuves.aisanceRequise ? preuve(preuves.aisance) : 'non_requis',
  }
}
