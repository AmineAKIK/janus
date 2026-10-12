import { ROUTES } from '@janus/contrats'
import { BandeauAlerte, Bouton, DialogueConfirmation, LigneReglage } from '@janus/ui'
import { useState } from 'react'
import { useEcriture } from '../../api/requetes.tsx'
import { TEXTES_CONFIRMATION as C, TEXTES_DONNEES as T } from '../textes.ts'
import { telecharger } from '../telecharger.ts'

export function SectionDonnees() {
  // `GET /export.json` n'a pas d'entrée : la lecture se fait à la demande, au clic.
  const lecture = useEcriture(ROUTES['GET /export.json'])
  const [echec, setEchec] = useState(false)
  const [demande, setDemande] = useState(false)

  return (
    <>
      <LigneReglage
        libelle={T.toutes}
        aide={T.toutesAide}
        controle={
          <Bouton
            type="button"
            variante="secondaire"
            chargement={lecture.isPending}
            onClick={() => {
              setDemande(true)
            }}
          >
            {T.exporter}
          </Bouton>
        }
      />
      {demande && (
        <DialogueConfirmation
          titre={C.export.titre}
          libelleConfirmer={C.export.confirmer}
          libelleAnnuler={C.annuler}
          enCours={lecture.isPending}
          surAnnuler={() => {
            setDemande(false)
          }}
          surConfirmer={() => {
            setEchec(false)
            lecture.mutate(
              {},
              {
                onSuccess: (donnees) => {
                  telecharger(T.nomFichier, JSON.stringify(donnees, null, 2), 'application/json')
                },
                onError: () => {
                  setEchec(true)
                },
                onSettled: () => {
                  setDemande(false)
                },
              },
            )
          }}
        >
          <p>{C.export.message}</p>
        </DialogueConfirmation>
      )}
      {echec && <BandeauAlerte type="erreur">{T.echec}</BandeauAlerte>}
    </>
  )
}
