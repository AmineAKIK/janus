/** L'heure réelle, en instant ISO 8601 UTC. */
export function instantReel(): string {
  return new Date(Date.now()).toISOString()
}
