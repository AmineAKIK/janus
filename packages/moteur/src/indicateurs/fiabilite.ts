import type { Reglages } from '@janus/contrats'
import type { Fait } from '../faits.ts'
import { dansLaPeriode } from './periode.ts'
import type { Periode } from './periode.ts'

/** Au-delà de cette part de désaccords, le tuteur se trompe trop souvent. */
export const SEUIL_DESACCORD = 0.15
/** Le nombre d'échantillons relus que regarde l'alerte. */
export const ECHANTILLONS_RECENTS = 30

/** Ce que le serveur sait d'une correction rendue : mise à l'avis d'Amine ou non, vérifiée ou non, et son avis. */
export interface ControleCorrection {
  readonly date: string
  /** La correction faisait partie de l'échantillon à relire. */
  readonly echantillon: boolean
  /** La réponse de l'IA n'a pas pu être vérifiée. */
  readonly nonVerifiee: boolean
  /** L'avis d'Amine : `true` d'accord, `false` pas d'accord, `null` pas encore donné. */
  readonly accord: boolean | null
}

export interface Fiabilite {
  /** Les échantillons auxquels Amine a répondu. */
  readonly copiesRelues: number
  /** Parmi eux, ceux où Amine n'était pas d'accord. */
  readonly desaccords: number
  /** Les corrections rendues sans avoir été vérifiées. */
  readonly nonVerifiees: number
  /** Les corrections contestées par Amine. */
  readonly contestations: number
  /** Vrai quand plus de 15 % des 30 derniers échantillons relus sont en désaccord. */
  readonly alerte: boolean
}

/** « Contrôle humain et signalements » : une contestation ne change jamais le niveau. */
export function fiabilite(
  controles: readonly ControleCorrection[],
  faits: readonly Fait[],
  periode: Periode,
  maintenant: string,
  reglages: Pick<Reglages, 'fuseau' | 'heureBascule'>,
): Fiabilite {
  const relues = controles
    .filter(({ echantillon, accord }) => echantillon && accord !== null)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  const dansPeriode = (date: string) => dansLaPeriode(date, periode, maintenant, reglages)
  const recentes = relues.slice(-ECHANTILLONS_RECENTS)
  const desaccordsRecents = recentes.filter(({ accord }) => accord === false).length
  return {
    copiesRelues: relues.filter(({ date }) => dansPeriode(date)).length,
    desaccords: relues.filter(({ date, accord }) => accord === false && dansPeriode(date)).length,
    nonVerifiees: controles.filter(({ date, nonVerifiee }) => nonVerifiee && dansPeriode(date))
      .length,
    contestations: faits.filter(
      (fait) => fait.type === 'correction_contestee' && dansPeriode(fait.date),
    ).length,
    alerte: desaccordsRecents / Math.max(recentes.length, 1) > SEUIL_DESACCORD,
  }
}
