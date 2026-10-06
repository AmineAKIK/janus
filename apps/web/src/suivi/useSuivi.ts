import { nomRoute, nouvelId, ROUTES } from '@janus/contrats'
import type { SortieRoute, Statut } from '@janus/contrats'
import { useQueryClient } from '@tanstack/react-query'
import { useEcriture, useLecture } from '../api/requetes.tsx'
import { instantReel } from '../demo/horlogeDemo.ts'

export type DonneesSuivi = SortieRoute<(typeof ROUTES)['GET /tableau-de-bord']>

export function useSuivi(requete: { readonly module?: string; readonly periode?: string }) {
  const client = useQueryClient()
  const lecture = useLecture(ROUTES['GET /tableau-de-bord'], {
    requete: {
      ...(requete.module === undefined ? {} : { module: requete.module }),
      ...(requete.periode === '7j' || requete.periode === '30j' || requete.periode === 'tout'
        ? { periode: requete.periode }
        : {}),
    },
  })
  const ecriture = useEcriture(ROUTES['POST /blocs/:id/forcer'])

  const apres = {
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: [nomRoute(ROUTES['GET /tableau-de-bord'])] })
      void client.invalidateQueries({ queryKey: [nomRoute(ROUTES['GET /aujourdhui'])] })
    },
  }
  const id = () => nouvelId(Date.parse(instantReel()))

  return {
    lecture,
    enCours: ecriture.isPending,
    echec: ecriture.isError,
    reinitialiserEchec: ecriture.reset,
    forcer: (bloc: string, statut: Statut, raison: string, surSucces: () => void) => {
      ecriture.mutate(
        { params: { id: bloc }, corps: { action: 'forcer', id: id(), statut, raison } },
        {
          onSuccess: () => {
            apres.onSuccess()
            surSucces()
          },
        },
      )
    },
    lever: (bloc: string) => {
      ecriture.mutate({ params: { id: bloc }, corps: { action: 'lever', id: id() } }, apres)
    },
  }
}
