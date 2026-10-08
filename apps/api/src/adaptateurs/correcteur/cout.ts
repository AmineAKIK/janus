import type { ResultatBrut } from './correcteur.ts'

/** Les tarifs par million de jetons, dans l'unité du budget (millionièmes), tirés de la configuration. */
export interface Tarifs {
  readonly entreeCache: number
  readonly entree: number
  readonly sortie: number
}

const MILLION = 1_000_000

/** Le coût d'un appel en millionièmes, arrondi au-dessus : jamais moins que le coût réel. */
export function coutMillioniemes(
  utilisation: Pick<ResultatBrut, 'jetonsEntree' | 'jetonsEntreeCache' | 'jetonsSortie'>,
  tarifs: Tarifs,
): number {
  const hors = Math.max(0, utilisation.jetonsEntree - utilisation.jetonsEntreeCache)
  const total =
    utilisation.jetonsEntreeCache * tarifs.entreeCache +
    hors * tarifs.entree +
    utilisation.jetonsSortie * tarifs.sortie
  return Math.ceil(total / MILLION)
}
