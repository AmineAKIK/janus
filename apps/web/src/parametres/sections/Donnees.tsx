import { ROUTES } from '@janus/contrats'
import { BandeauAlerte, Bouton, LigneReglage } from '@janus/ui'
import { useState } from 'react'
import { useEcriture } from '../../api/requetes.tsx'
import { TEXTES_DONNEES as T } from '../textes.ts'
import { telecharger } from '../telecharger.ts'

export function SectionDonnees() {
  // `GET /export.json` n'a pas d'entrée : la lecture se fait à la demande, au clic.
  const lecture = useEcriture(ROUTES['GET /export.json'])
  const [echec, setEchec] = useState(false)

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
                },
              )
            }}
          >
            {T.exporter}
          </Bouton>
        }
      />
      {echec && <BandeauAlerte type="erreur">{T.echec}</BandeauAlerte>}
    </>
  )
}
