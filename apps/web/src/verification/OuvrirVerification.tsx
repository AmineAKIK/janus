import { ROUTES, TypeVerification } from '@janus/contrats'
import { useEffect } from 'react'
import { estIntrouvable, useEcriture } from '../api/requetes.tsx'
import { Chargement, Erreur } from '../catalogue/EtatEcran.tsx'

/**
 * Le lien d'une vérification de la file du jour : la file ne tire rien, c'est cette page qui ouvre
 * la vérification (`POST /verifications`, idempotent) puis la remplace dans l'historique.
 */
export function OuvrirVerification({
  bloc,
  type,
  surOuverte,
}: {
  readonly bloc: string
  readonly type: string
  readonly surOuverte: (id: string) => void
}) {
  const typeConnu = TypeVerification.safeParse(type)
  const ouvrir = useEcriture(ROUTES['POST /verifications'])
  const { mutate } = ouvrir

  useEffect(() => {
    if (!typeConnu.success) return
    mutate(
      { corps: { bloc, type: typeConnu.data } },
      {
        onSuccess: ({ id }) => {
          surOuverte(id)
        },
      },
    )
    // Une ouverture par bloc et par type : `surOuverte` change à chaque rendu sans changer de sens.
  }, [bloc, typeConnu.success, mutate])

  if (!typeConnu.success) return <Erreur introuvable reessayer={() => undefined} />
  if (ouvrir.isError) {
    return (
      <Erreur
        introuvable={estIntrouvable(ouvrir.error)}
        reessayer={() => {
          mutate(
            { corps: { bloc, type: typeConnu.data } },
            {
              onSuccess: ({ id }) => {
                surOuverte(id)
              },
            },
          )
        }}
      />
    )
  }
  return <Chargement nombre={2} />
}
