/** Le seul endroit de l'API qui lit l'heure du système : tout le reste reçoit une `Horloge`. */
export interface Horloge {
  /** L'instant présent, en ISO 8601 UTC (`2026-06-01T10:00:00.000Z`). */
  readonly maintenant: () => string
  /** Un compteur monotone en millisecondes, pour mesurer des durées. */
  readonly chrono: () => number
}

export const horlogeSysteme: Horloge = {
  maintenant: () => new Date().toISOString(),
  chrono: () => performance.now(),
}
