import type { Confiance, Reglages } from '@janus/contrats'
import type { Fait } from '../faits.ts'
import { dansLaPeriode } from './periode.ts'
import type { Periode } from './periode.ts'
import { semaineDe } from './semaines.ts'

/** Dans l'ordre du tableau de Figma. */
export const CONFIANCES: readonly Confiance[] = ['sur', 'hesitant', 'hasard']

export interface LigneCalibration {
  readonly confiance: Confiance
  /** Corrigées au niveau solide, au premier tour. */
  readonly justes: number
  readonly faux: number
}

export interface ErreurEnEtantSur {
  readonly bloc: string
  readonly question: string
  readonly date: string
}

export interface Calibration {
  readonly lignes: readonly LigneCalibration[]
  /** Les erreurs commises en étant sûr pendant la semaine courante, quelle que soit la période. */
  readonly erreursSuresCetteSemaine: readonly ErreurEnEtantSur[]
}

/**
 * La confiance déclarée avant correction face au résultat. Une réponse est juste quand sa
 * correction est solide au premier tour, toutes séries confondues.
 */
export function calibration(
  faits: readonly Fait[],
  periode: Periode,
  maintenant: string,
  reglages: Pick<Reglages, 'fuseau' | 'heureBascule'>,
): Calibration {
  const premiers = faits.flatMap((fait) =>
    fait.type === 'correction' && fait.tour === 1 ? [fait] : [],
  )
  const courante = semaineDe(maintenant, reglages)
  return {
    lignes: CONFIANCES.map((confiance) => {
      const choisies = premiers.filter(
        (fait) =>
          fait.confiance === confiance && dansLaPeriode(fait.date, periode, maintenant, reglages),
      )
      const justes = choisies.filter(({ niveau }) => niveau === 'solide').length
      return { confiance, justes, faux: choisies.length - justes }
    }),
    erreursSuresCetteSemaine: premiers
      .filter(
        (fait) =>
          fait.confiance === 'sur' &&
          fait.niveau !== 'solide' &&
          semaineDe(fait.date, reglages) === courante,
      )
      .map(({ bloc, question, date }) => ({ bloc, question, date })),
  }
}
