import type { Base } from '../../base/base.ts'

/** L'accès à la base pour la santé : une seule question, « réponds-tu ? ». */
export function creerDepotSante(base: Base) {
  return {
    baseRepond: async (): Promise<boolean> => {
      try {
        await base.requete('SELECT 1')
        return true
      } catch {
        return false
      }
    },
  }
}
export type DepotSante = ReturnType<typeof creerDepotSante>
