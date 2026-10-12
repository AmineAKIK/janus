import { nouvelId, ROUTES } from '@janus/contrats'
import type { SortieRoute } from '@janus/contrats'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useEcriture, useLecture } from '../api/requetes.tsx'
import { DialoguePrerequis } from '../catalogue/DialoguePrerequis.tsx'
import { ACQUIS_AU_MOINS_PROVISOIRE } from '../catalogue/useBlocs.ts'
import { instantReel } from '../horloge.ts'
import { dejaOuvert, marquerOuvert } from './ouvertures.ts'

type Detail = SortieRoute<(typeof ROUTES)['GET /blocs/:id']>

/**
 * Tout chemin vers un bloc passe par l'ouverture enregistrée, comme depuis le catalogue : sans
 * prérequis en suspens elle se fait en silence, sinon la page demande la raison avant de s'afficher.
 */
export function GardeOuverture({
  detail,
  children,
}: {
  readonly detail: Detail
  readonly children: ReactNode
}) {
  const ecriture = useEcriture(ROUTES['POST /blocs/:id/ouvrir'])
  const navigate = useNavigate()
  const liste = useLecture(ROUTES['GET /modules/:id/blocs'], { params: { id: detail.module } })
  const [ouvert, setOuvert] = useState(() => dejaOuvert(detail.bloc))
  const libre = detail.acces === 'libre'
  const { mutate } = ecriture

  useEffect(() => {
    if (ouvert || !libre) return
    mutate(
      {
        params: { id: detail.bloc },
        corps: { id: nouvelId(Date.parse(instantReel())), hors_prerequis: false },
      },
      {
        onSuccess: () => {
          marquerOuvert(detail.bloc)
          setOuvert(true)
        },
      },
    )
  }, [ouvert, libre, mutate, detail.bloc])

  // Sans réponse du serveur, un bloc libre se lit quand même : la trace sera prise à la prochaine visite.
  if (ouvert || libre) return children

  const statuts = new Map((liste.data?.blocs ?? []).map(({ bloc, statut }) => [bloc, statut]))
  const manquants = detail.manifeste.prerequis.filter(
    (code) => !ACQUIS_AU_MOINS_PROVISOIRE.includes(statuts.get(code) ?? 'non_commence'),
  )
  const sortir = () => {
    void navigate({
      to: '/modules/$moduleId',
      params: { moduleId: detail.module },
      search: {},
    })
  }
  return (
    <DialoguePrerequis
      manquants={manquants.length === 0 ? detail.manifeste.prerequis : manquants}
      enCours={ecriture.isPending}
      echec={ecriture.isError}
      surOuvrir={(raison) => {
        ecriture.mutate(
          {
            params: { id: detail.bloc },
            corps: {
              id: nouvelId(Date.parse(instantReel())),
              hors_prerequis: true,
              raison,
            },
          },
          {
            onSuccess: () => {
              marquerOuvert(detail.bloc)
              setOuvert(true)
            },
          },
        )
      }}
      surAller={(code) => {
        void navigate({
          to: '/modules/$moduleId',
          params: { moduleId: detail.module },
          search: { detail: code },
        })
      }}
      surFermeture={sortir}
    />
  )
}
