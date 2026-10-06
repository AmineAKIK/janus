import { ErreurApi, nomRoute, ROUTES } from '@janus/contrats'
import type { ModificationReglages } from '@janus/contrats'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useEcriture, useLecture } from '../api/requetes.tsx'

export type EtatEnregistrement = 'repos' | 'conflit' | 'echec'

export function useReglages() {
  const client = useQueryClient()
  const lecture = useLecture(ROUTES['GET /reglages'], {})
  const ecriture = useEcriture(ROUTES['PATCH /reglages'])
  const [etat, setEtat] = useState<EtatEnregistrement>('repos')

  function enregistrer(corps: ModificationReglages) {
    ecriture.mutate(
      { corps },
      {
        onSuccess: (reglages) => {
          setEtat('repos')
          client.setQueryData([nomRoute(ROUTES['GET /reglages']), {}], reglages)
          // Les écrans qui calculent avec les réglages (Aujourd'hui, questions) se relisent.
          void client.invalidateQueries({ queryKey: [nomRoute(ROUTES['GET /aujourdhui']), {}] })
          void client.invalidateQueries({ queryKey: [nomRoute(ROUTES['GET /questions-debut'])] })
        },
        onError: (erreur) => {
          if (erreur instanceof ErreurApi && erreur.status === 412) {
            setEtat('conflit')
            void lecture.refetch()
          } else setEtat('echec')
        },
      },
    )
  }

  return {
    reglages: lecture.data,
    erreur: lecture.isError,
    recharger: () => {
      void lecture.refetch()
    },
    etat,
    enregistrer,
  }
}
