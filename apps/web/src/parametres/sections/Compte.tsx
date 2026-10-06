import { ROUTES } from '@janus/contrats'
import type { ModificationReglages, Reglages } from '@janus/contrats'
import { BandeauAlerte, Bouton, LigneLectureSeule, LigneReglage } from '@janus/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useEcriture, useLecture } from '../../api/requetes.tsx'
import { ChampReglage } from '../ChampReglage.tsx'
import styles from '../Parametres.module.css'
import { TEXTES_COMPTE as T } from '../textes.ts'
import { ChangerMotDePasse } from './ChangerMotDePasse.tsx'
import { Sessions } from './Sessions.tsx'

const FUSEAUX = Intl.supportedValuesOf('timeZone')

interface Proprietes {
  readonly reglages: Reglages
  readonly enregistrer: (corps: ModificationReglages) => void
}

export function SectionCompte({ reglages, enregistrer }: Proprietes) {
  const client = useQueryClient()
  const moi = useLecture(ROUTES['GET /moi'], {})
  const deconnexion = useEcriture(ROUTES['DELETE /session'])
  const [dialogue, setDialogue] = useState(false)
  const [change, setChange] = useState(false)
  const fuseaux = FUSEAUX.includes(reglages.fuseau) ? FUSEAUX : [reglages.fuseau, ...FUSEAUX]

  return (
    <>
      {moi.data !== undefined && (
        <LigneLectureSeule libelle={T.nomUtilisateur} valeur={moi.data.nom_utilisateur} />
      )}
      <LigneReglage
        libelle={T.motDePasse}
        controle={
          <Bouton
            type="button"
            variante="secondaire"
            onClick={() => {
              setChange(false)
              setDialogue(true)
            }}
          >
            {T.changer}
          </Bouton>
        }
      />
      {change && <BandeauAlerte type="succes">{T.motDePasseChange}</BandeauAlerte>}
      <LigneReglage
        libelle={T.fuseau}
        controle={
          <select
            aria-label={T.fuseau}
            className={`${styles['selection'] ?? ''} texte-corps-16`}
            value={reglages.fuseau}
            onChange={(evenement) => {
              enregistrer({ fuseau: evenement.target.value })
            }}
          >
            {fuseaux.map((fuseau) => (
              <option key={fuseau} value={fuseau}>
                {fuseau}
              </option>
            ))}
          </select>
        }
      />
      <ChampReglage
        cle="heureBascule"
        libelle={T.heureBascule}
        valeur={reglages.heureBascule}
        defaut={4}
        enregistrer={enregistrer}
      />
      <Sessions />
      <Bouton
        type="button"
        variante="secondaire"
        onClick={() => {
          deconnexion.mutate(
            {},
            {
              onSuccess: () => {
                client.clear()
                window.location.hash = '/connexion'
              },
            },
          )
        }}
      >
        {T.seDeconnecter}
      </Bouton>
      {dialogue && (
        <ChangerMotDePasse
          surFermeture={() => {
            setDialogue(false)
          }}
          surChange={() => {
            setDialogue(false)
            setChange(true)
          }}
        />
      )}
    </>
  )
}
