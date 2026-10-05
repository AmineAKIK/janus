/** Ordre des textes, sans dépendre de la langue de la machine. */
export function comparer(a: string, b: string): number {
  if (a < b) return -1
  return a > b ? 1 : 0
}
