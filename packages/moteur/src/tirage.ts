import type { Differee, Manifeste, Reglages, TypeDifferee } from '@janus/contrats'
import { ecartEnJours, jourDe } from './temps.ts'
import type { Jour } from './temps.ts'

/** Une question différée déjà posée, et quand. */
export interface DejaPosee {
  readonly question: string
  readonly date: string
}

/**
 * Tire la question différée d'une vérification : une question du type demandé jamais posée (la
 * première du manifeste) ; si la réserve est épuisée, celle qui n'a pas été posée depuis au moins
 * `joursAvantReutilisation` jours (la plus anciennement posée) ; sinon `null`, et l'interface le signale.
 */
export function tirerDifferee(
  manifeste: Manifeste,
  type: TypeDifferee,
  dejaPosees: readonly DejaPosee[],
  maintenant: string,
  reglages: Reglages,
): Differee | null {
  const jour = (instant: string) => jourDe(instant, reglages.fuseau, reglages.heureBascule)
  // Le dernier jour (le plus grand, ces jours se comparent comme du texte) de chaque question posée.
  const dernierePose = new Map<string, Jour>()
  for (const { question, date } of dejaPosees) {
    const posee = jour(date)
    const connue = dernierePose.get(question)
    if (connue === undefined || posee > connue) dernierePose.set(question, posee)
  }
  const candidates = manifeste.differees
    .filter((differee) => differee.type === type)
    .map((differee) => ({
      differee,
      // Le jour de la dernière fois où elle a été posée, `null` si jamais.
      pose: dernierePose.get(differee.id) ?? null,
    }))

  const jamaisPosee = candidates.find(({ pose }) => pose === null)
  if (jamaisPosee !== undefined) return jamaisPosee.differee

  const aujourdhui = jour(maintenant)
  return (
    candidates
      .flatMap(({ differee, pose }) =>
        pose !== null && ecartEnJours(pose, aujourdhui) >= reglages.joursAvantReutilisation
          ? [{ differee, pose }]
          : [],
      )
      .sort((a, b) => (a.pose < b.pose ? -1 : a.pose > b.pose ? 1 : 0))
      .at(0)?.differee ?? null
  )
}
