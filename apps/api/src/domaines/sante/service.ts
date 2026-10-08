import type { DepotSante } from './depot.ts'

export interface EtatSante {
  readonly ok: boolean
  readonly base: boolean
}

export function creerServiceSante(depot: DepotSante) {
  return {
    etat: async (): Promise<EtatSante> => {
      const base = await depot.baseRepond()
      return { ok: base, base }
    },
  }
}
export type ServiceSante = ReturnType<typeof creerServiceSante>
