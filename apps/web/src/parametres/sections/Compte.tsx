import { ROUTES } from '@janus/contrats'
import type { ModificationReglages, Reglages } from '@janus/contrats'
import {
  BandeauAlerte,
  Bouton,
  DialogueConfirmation,
  LigneLectureSeule,
  LigneReglage,
  Selecteur,
} from '@janus/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useEcriture, useLecture } from '../../api/requetes.tsx'
import { ChampReglage } from '../ChampReglage.tsx'
import styles from '../Parametres.module.css'
import { useBoiteEnvoi } from '../../envoi/FournisseurEnvoi.tsx'
import { useEnAttente } from '../../envoi/useEnAttente.ts'
import { TEXTES_COMPTE as T, TEXTES_CONFIRMATION as C } from '../textes.ts'
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
  const [sortir, setSortir] = useState(false)
  const enAttente = useEnAttente()
  const boite = useBoiteEnvoi()
  const [envoi, setEnvoi] = useState(false)
  const [bloquee, setBloquee] = useState(0)
  const sortirVraiment = () => {
    deconnexion.mutate(
      {},
      {
        onSuccess: () => {
          client.clear()
          aller('/connexion')
        },
        onSettled: () => {
          setSortir(false)
        },
      },
    )
  }
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
          setSortir(true)
        }}
      >
        {T.seDeconnecter}
      </Bouton>
      {sortir && (
        <DialogueConfirmation
          titre={C.deconnexion.titre}
          libelleConfirmer={T.seDeconnecter}
          libelleAnnuler={C.annuler}
          enCours={envoi || deconnexion.isPending}
          surAnnuler={() => {
            setSortir(false)
            setBloquee(0)
          }}
          surConfirmer={() => {
            setBloquee(0)
            setEnvoi(true)
            void boite
              .vider()
              .then(() => boite.entrees())
              .then((restantes) => {
                setEnvoi(false)
                if (restantes.length > 0) {
                  setBloquee(restantes.length)
                  return
                }
                sortirVraiment()
              })
          }}
        >
          <p>{C.deconnexion.message}</p>
          {bloquee > 0 ? (
            <p role="alert">{C.deconnexion.bloquee(bloquee)}</p>
          ) : (
            enAttente > 0 && <p>{C.deconnexion.enAttente(enAttente)}</p>
          )}
        </DialogueConfirmation>
      )}
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
