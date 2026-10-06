import type { Reglages, Statut } from '@janus/contrats'
import type { Fait } from '../faits.ts'
import { instantEnMs } from '../temps.ts'
import { dansLaPeriode } from './periode.ts'
import type { Periode } from './periode.ts'

export interface StatutForce {
  readonly date: string
  readonly bloc: string
  readonly statut: Statut
  readonly raison: string
}

export interface OuvertureSansPrerequis {
  readonly date: string
  readonly bloc: string
  readonly raison: string | null
}

const plusRecentsDabord = (a: { readonly date: string }, b: { readonly date: string }) =>
  instantEnMs(b.date) - instantEnMs(a.date)

/** Les statuts forcés, les plus récents d'abord. Un forçage levé reste dans l'historique. */
export function statutsForces(
  faits: readonly Fait[],
  periode: Periode,
  maintenant: string,
  reglages: Pick<Reglages, 'fuseau' | 'heureBascule'>,
): StatutForce[] {
  return faits
    .flatMap((fait) =>
      fait.type === 'statut_force' && dansLaPeriode(fait.date, periode, maintenant, reglages)
        ? [{ date: fait.date, bloc: fait.bloc, statut: fait.statut, raison: fait.raison }]
        : [],
    )
    .sort(plusRecentsDabord)
}

/** Les ouvertures de bloc sans ses prérequis, avec la raison donnée, les plus récentes d'abord. */
export function ouverturesSansPrerequis(
  faits: readonly Fait[],
  periode: Periode,
  maintenant: string,
  reglages: Pick<Reglages, 'fuseau' | 'heureBascule'>,
): OuvertureSansPrerequis[] {
  return faits
    .flatMap((fait) =>
      fait.type === 'bloc_ouvert' &&
      fait.horsPrerequis &&
      dansLaPeriode(fait.date, periode, maintenant, reglages)
        ? [{ date: fait.date, bloc: fait.bloc, raison: fait.raison ?? null }]
        : [],
    )
    .sort(plusRecentsDabord)
}

/** Les blocs qui ont été ouverts sans leurs prérequis, sur toute l'histoire (la marque de la carte). */
export function blocsOuvertsSansPrerequis(faits: readonly Fait[]): ReadonlySet<string> {
  return new Set(
    faits.flatMap((fait) => (fait.type === 'bloc_ouvert' && fait.horsPrerequis ? [fait.bloc] : [])),
  )
}
