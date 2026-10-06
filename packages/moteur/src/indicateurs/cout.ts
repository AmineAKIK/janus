import type { Reglages } from '@janus/contrats'
import { jourDe } from '../temps.ts'

export interface CoutIa {
  readonly date: string
  /** En millionièmes d'euro, comme le plafond des réglages. */
  readonly millioniemes: number
}

const mois = (instant: string, reglages: Pick<Reglages, 'fuseau' | 'heureBascule'>) =>
  jourDe(instant, reglages.fuseau, reglages.heureBascule).slice(0, 7)

/** Ce que l'IA a coûté pendant le mois de `maintenant` (le mois des jours avec bascule). */
export function depenseDuMois(
  couts: readonly CoutIa[],
  maintenant: string,
  reglages: Pick<Reglages, 'fuseau' | 'heureBascule'>,
): number {
  const courant = mois(maintenant, reglages)
  return couts.reduce(
    (total, { date, millioniemes }) =>
      mois(date, reglages) === courant ? total + millioniemes : total,
    0,
  )
}

/** La part du plafond dépensée, entre 0 et 1 ; un plafond à zéro est toujours atteint. */
export function partDuBudget(depense: number, plafond: number): number {
  if (plafond <= 0) return 1
  return Math.min(1, depense / plafond)
}

/** Au-dessus de 80 % seulement, la barre passe en alerte. */
export const SEUIL_ALERTE_BUDGET = 0.8
export const budgetEnAlerte = (part: number): boolean => part > SEUIL_ALERTE_BUDGET
