import { ROUTES } from '@janus/contrats'
import type { ModificationReglages, Reglages } from '@janus/contrats'
import { BandeauAlerte, Bouton, LigneLectureSeule, LigneReglage, Selecteur } from '@janus/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useEcriture, useLecture } from '../../api/requetes.tsx'
import { ChampReglage } from '../ChampReglage.tsx'
import styles from '../Parametres.module.css'
import { TEXTES_COMPTE as T } from '../textes.ts'
import { ChangerMotDePasse } from './ChangerMotDePasse.tsx'
import { Sessions } from './Sessions.tsx'
import { aller } from '../../routes/navigation.ts'

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
            aria-label={T.changer}
            onClick={() => {
              setChange(false)
              setDialogue(true)
            }}
          >
            {T.modifier}
          </Bouton>
        }
      />
      {change && <BandeauAlerte type="succes">{T.motDePasseChange}</BandeauAlerte>}
      <LigneReglage
        className={styles['ligneChamp'] ?? ''}
        libelle={T.fuseau}
        controle={
          <Selecteur
            libelle={T.fuseau}
            libelleMasque
            valeur={reglages.fuseau}
            options={fuseaux.map((fuseau) => ({ valeur: fuseau, libelle: fuseau }))}
            onChange={(fuseau) => {
              enregistrer({ fuseau })
            }}
            className={styles['selection']}
          />
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
                aller('/connexion')
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
