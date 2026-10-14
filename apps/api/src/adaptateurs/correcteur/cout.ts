import type { ResultatBrut } from './correcteur.ts'

/** Les tarifs par million de jetons, dans l'unité du budget (millionièmes), tirés de la configuration. */
export interface Tarifs {
  readonly entreeCache: number
  readonly entree: number
  readonly sortie: number
}

const MILLION = 1_000_000
/** L'écriture dans le cache de Claude coûte un quart de plus que l'entrée (5 minutes de validité). */
const MAJORATION_ECRITURE_CACHE = 1.25

/** Le coût d'un appel en millionièmes, arrondi au-dessus : jamais moins que le coût réel. */
export function coutMillioniemes(
  utilisation: Pick<
    ResultatBrut,
    'jetonsEntree' | 'jetonsEntreeCache' | 'jetonsEntreeCacheEcrits' | 'jetonsSortie'
  >,
  tarifs: Tarifs,
): number {
  const ecrits = utilisation.jetonsEntreeCacheEcrits ?? 0
  const hors = Math.max(0, utilisation.jetonsEntree - utilisation.jetonsEntreeCache - ecrits)
  const total =
    utilisation.jetonsEntreeCache * tarifs.entreeCache +
    ecrits * tarifs.entree * MAJORATION_ECRITURE_CACHE +
    hors * tarifs.entree +
    utilisation.jetonsSortie * tarifs.sortie
  return Math.ceil(total / MILLION)
}
