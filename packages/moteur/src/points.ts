import type { Niveau } from '@janus/contrats'

const POINTS: Record<Niveau, number> = {
  solide: 1,
  partiel: 0.5,
  fragile: 0.25,
  pas_encore: 0,
}

/** Points que rapporte une réponse selon son niveau. */
export function points(niveau: Niveau): number {
  return POINTS[niveau]
}
