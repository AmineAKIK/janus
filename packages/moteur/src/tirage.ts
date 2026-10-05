import type { Differee, Manifeste, Reglages, TypeDifferee } from '@janus/contrats'
import { ecartEnJours, jourDe } from './temps.ts'

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
  const candidates = manifeste.differees
    .filter((differee) => differee.type === type)
    .map((differee) => ({
      differee,
      // Le jour de la dernière fois où elle a été posée, `null` si jamais.
      pose:
        dejaPosees
          .filter(({ question }) => question === differee.id)
          .map(({ date }) => jour(date))
          .sort()
          .at(-1) ?? null,
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
