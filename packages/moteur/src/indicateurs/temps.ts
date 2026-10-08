import type { Reglages, TypeEtape } from '@janus/contrats'
import { semaineDe } from './semaines.ts'

/** Une durée de temps actif reçue : à quel bloc, et pendant quel type d'étape si l'appli le savait. */
export interface MesureTemps {
  readonly date: string
  readonly bloc: string
  readonly secondes: number
  readonly etape?: TypeEtape | undefined
}

export type GroupeTemps = 'lecture' | 'pratique' | 'restitution'

/** Les types d'étape regroupés comme l'écran : Lecture, Pratique, Restitution. */
export const GROUPE_DE_L_ETAPE: Readonly<Record<TypeEtape, GroupeTemps>> = {
  carte: 'lecture',
  pretest: 'lecture',
  explication: 'lecture',
  pratique: 'pratique',
  atelier: 'pratique',
  aisance: 'pratique',
  restitution: 'restitution',
  consolidation: 'restitution',
  bilan: 'restitution',
}

export interface Temps {
  /** Tout le temps actif de la semaine, y compris celui dont l'étape n'est pas connue. */
  readonly totalS: number
  /** Le temps par groupe d'étapes. */
  readonly groupes: Readonly<Record<GroupeTemps, number>>
  /** Le temps par bloc, le plus long d'abord, à égalité par code. */
  readonly blocs: readonly { readonly bloc: string; readonly secondes: number }[]
}

/** « Temps actif de la semaine » : une mesure, jamais un objectif. */
export function tempsActif(
  mesures: readonly MesureTemps[],
  maintenant: string,
  reglages: Pick<Reglages, 'fuseau' | 'heureBascule'>,
): Temps {
  const courante = semaineDe(maintenant, reglages)
  const groupes: Record<GroupeTemps, number> = { lecture: 0, pratique: 0, restitution: 0 }
  const parBloc = new Map<string, number>()
  let totalS = 0
  for (const mesure of mesures) {
    if (semaineDe(mesure.date, reglages) !== courante) continue
    totalS += mesure.secondes
    parBloc.set(mesure.bloc, (parBloc.get(mesure.bloc) ?? 0) + mesure.secondes)
    if (mesure.etape !== undefined) groupes[GROUPE_DE_L_ETAPE[mesure.etape]] += mesure.secondes
  }
  const blocs = [...parBloc]
    .map(([bloc, secondes]) => ({ bloc, secondes }))
    .sort((a, b) => b.secondes - a.secondes || a.bloc.localeCompare(b.bloc))
  return { totalS, groupes, blocs }
}
