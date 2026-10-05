// Le seul endroit de la bibliothèque qui lit l'heure (AGENTS.md : jamais `Date` ailleurs).

/** Les millisecondes depuis 1970. */
export function maintenantMs(): number {
  return Date.now()
}

/** Un instant ISO 8601 en UTC (`2026-06-01T10:00:00.000Z`). */
export function enIso(ms: number): string {
  return new Date(ms).toISOString()
}
