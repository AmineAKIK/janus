/**
 * La liste de ceux qui veulent savoir quand un état change : `abonner` rend la fonction qui
 * arrête d'écouter, `signaler` prévient tout le monde. C'est la forme qu'attend
 * `useSyncExternalStore`.
 */
export function creerAbonnes() {
  const abonnes = new Set<() => void>()
  return {
    abonner: (abonne: () => void): (() => void) => {
      abonnes.add(abonne)
      return () => {
        abonnes.delete(abonne)
      }
    },
    signaler: (): void => {
      abonnes.forEach((abonne) => {
        abonne()
      })
    },
  }
}
