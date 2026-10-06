import { nomRoute, nouvelId, ROUTES } from '@janus/contrats'
import type { Confiance, SortieRoute } from '@janus/contrats'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useLecture } from '../api/requetes.tsx'
import { instantReel } from '../demo/horlogeDemo.ts'
import { useBoiteEnvoi } from '../envoi/FournisseurEnvoi.tsx'
import type { ResultatVerification } from './textes.ts'

type Vue = SortieRoute<(typeof ROUTES)['GET /verifications/:id']>
export type Partie = Vue['parties'][number]

const ROUTE_LECTURE = ROUTES['GET /verifications/:id']
const ROUTE_REPONSES = ROUTES['POST /verifications/:id/reponses']

export interface Saisie {
  readonly reponse: string
  readonly confiance: Confiance
  readonly colle: boolean
  readonly code?: { readonly reussis: number; readonly total: number }
}

/** Où en est l'envoi d'une partie : en route, envoyée, ou refusée parce que la correction est impossible. */
type Envoi = 'envoi' | 'envoyee' | 'indisponible'

export function useVerification(id: string) {
  const boite = useBoiteEnvoi()
  const client = useQueryClient()
  const lecture = useLecture(ROUTE_LECTURE, { params: { id } })
  const [envois, setEnvois] = useState<Readonly<Record<string, Envoi>>>({})
  const [saisies, setSaisies] = useState<Readonly<Record<string, Saisie>>>({})
  const [resultatLocal, setResultatLocal] = useState<ResultatVerification | null>(null)

  const parties = lecture.data?.parties ?? []
  const etat = (partie: Partie): Envoi | 'a_faire' =>
    envois[partie.id] ?? (partie.envoyee ? 'envoyee' : 'a_faire')

  const poser = (partie: string, envoi: Envoi) => {
    setEnvois((avant) => ({ ...avant, [partie]: envoi }))
  }

  function envoyer(partie: Partie, saisie: Saisie) {
    const message = nouvelId(Date.parse(instantReel()))
    setSaisies((avant) => ({ ...avant, [partie.id]: saisie }))
    poser(partie.id, 'envoi')
    void boite.ajouter(
      {
        id: message,
        route: 'POST /verifications/:id/reponses',
        params: { id },
        corps: {
          id: message,
          partie: partie.id,
          reponse: saisie.reponse,
          confiance: saisie.confiance,
          support: { colle: saisie.colle, retour_cours: false },
          ...(saisie.code === undefined ? {} : { code: saisie.code }),
        },
      },
      {
        surReponse: (reponse) => {
          const lue = ROUTE_REPONSES.reponse.parse(reponse)
          poser(partie.id, 'envoyee')
          if (lue.resultat !== undefined) setResultatLocal(lue.resultat)
          void client.invalidateQueries({ queryKey: [nomRoute(ROUTE_LECTURE), { params: { id } }] })
          void client.invalidateQueries({ queryKey: [nomRoute(ROUTES['GET /aujourdhui']), {}] })
        },
        surRefus: () => {
          poser(partie.id, 'indisponible')
        },
      },
    )
  }

  const aFaire = parties.filter((partie) => etat(partie) !== 'envoyee')
  const resultat = resultatLocal ?? lecture.data?.resultat ?? null

  return {
    phase: lecture.isError
      ? ('erreur' as const)
      : lecture.data === undefined
        ? ('chargement' as const)
        : ('prete' as const),
    recharger: () => {
      void lecture.refetch()
    },
    vue: lecture.data,
    parties,
    etat,
    saisies,
    envoyer,
    /** La première partie sans réponse envoyée. */
    courante: aFaire[0],
    commencee: parties.some((partie) => etat(partie) !== 'a_faire'),
    resultat,
  }
}
