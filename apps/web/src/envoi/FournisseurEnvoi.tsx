import { nomRoute, ROUTES } from '@janus/contrats'
import { useQueryClient } from '@tanstack/react-query'
import { createContext, use, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { BoiteEnvoi } from './boiteEnvoi.ts'

const ContexteEnvoi = createContext<BoiteEnvoi | null>(null)

const NOM_MOI = nomRoute(ROUTES['GET /moi'])

/**
 * Donne la boîte d'envoi à l'appli et la démarre (retour du réseau, retour au premier plan, envoi
 * périodique). Une session retrouvée relance l'envoi qu'un `401` avait suspendu.
 */
export function FournisseurEnvoi({
  boite,
  children,
}: {
  readonly boite: BoiteEnvoi
  readonly children: ReactNode
}) {
  const client = useQueryClient()

  useEffect(() => boite.demarrer(), [boite])
  useEffect(
    () =>
      client.getQueryCache().subscribe((evenement) => {
        if (evenement.type !== 'updated' || evenement.action.type !== 'success') return
        const cle: unknown = evenement.query.queryKey
        if (Array.isArray(cle) && cle[0] === NOM_MOI) void boite.reprendre()
      }),
    [boite, client],
  )

  return <ContexteEnvoi value={boite}>{children}</ContexteEnvoi>
}

export function useBoiteEnvoi(): BoiteEnvoi {
  const boite = use(ContexteEnvoi)
  if (boite === null) throw new Error('FournisseurEnvoi manquant')
  return boite
}
