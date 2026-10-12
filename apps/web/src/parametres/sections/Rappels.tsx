import { nouvelId, ROUTES } from '@janus/contrats'
import type { ModificationReglages, Reglages } from '@janus/contrats'
import { Bouton, ChampDate, ChampHeure, LigneReglage } from '@janus/ui'
import { useEffect, useState } from 'react'
import { modeTransport } from '../../api/client.ts'
import { useEcriture, useLecture } from '../../api/requetes.tsx'
import { instantReel } from '../../horloge.ts'
import {
  abonnementGarde,
  abonnerCetAppareil,
  garderAbonnement,
  retirerCetAppareil,
} from '../push.ts'
import styles from '../Parametres.module.css'
import { TEXTES_PARAMETRES as TP, TEXTES_RAPPELS as T } from '../textes.ts'

const DEFAUTS = { heureRappel: '19:00' } as const

interface Proprietes {
  readonly reglages: Reglages
  readonly enregistrer: (corps: ModificationReglages) => void
}

/** Le jour d'aujourd'hui dans le fuseau de l'utilisateur, `AAAA-MM-JJ`. */
function jourLocal(fuseau: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuseau }).format(Date.parse(instantReel()))
}

/** Le navigateur sait-il demander l'autorisation d'afficher des notifications ? */
const permissionConnue = () => typeof Notification !== 'undefined'

export function SectionRappels({ reglages, enregistrer }: Proprietes) {
  const enDemo = modeTransport(import.meta.env.VITE_TRANSPORT) === 'demo'
  const moi = useLecture(ROUTES['GET /moi'], {})
  const abonnement = useEcriture(ROUTES['POST /push/abonnements'])
  const retrait = useEcriture(ROUTES['DELETE /push/abonnements/:id'])
  const [abonne, setAbonne] = useState(abonnementGarde)
  const cleVapid = moi.data?.cle_vapid
  const [permission, setPermission] = useState<NotificationPermission | null>(
    permissionConnue() ? Notification.permission : null,
  )

  const [sansChoix, setSansChoix] = useState(false)
  const [echec, setEchec] = useState(false)

  // L'autorisation se change aussi dans les réglages du navigateur : on la relit au retour sur l'appli.
  useEffect(() => {
    if (!permissionConnue()) return
    const relire = () => {
      setPermission(Notification.permission)
    }
    document.addEventListener('visibilitychange', relire)
    window.addEventListener('focus', relire)
    return () => {
      document.removeEventListener('visibilitychange', relire)
      window.removeEventListener('focus', relire)
    }
  }, [])

  function demander() {
    if (cleVapid === undefined) return
    setEchec(false)
    void abonnerCetAppareil(cleVapid)
      .catch(() => {
        setEchec(true)
        return null
      })
      .then((donnees) => {
        setPermission(Notification.permission)
        // Retour sans choisir : la demande reste possible, l'appli le dit au lieu de faire comme un refus.
        setSansChoix(Notification.permission === 'default')
        if (donnees === null) return
        const id = nouvelId(Date.parse(instantReel()))
        abonnement.mutate(
          { corps: { id, ...donnees } },
          {
            onSuccess: () => {
              garderAbonnement(id)
              setAbonne(id)
            },
          },
        )
      })
  }

  function desactiver() {
    if (abonne === null) return
    retrait.mutate(
      { params: { id: abonne } },
      {
        onSuccess: () => {
          garderAbonnement(null)
          setAbonne(null)
          void retirerCetAppareil()
        },
      },
    )
  }

  const pause = reglages.rappelsEnPauseJusquAu
  return (
    <>
      <p className="texte-corps-16">{T.introduction}</p>
      <LigneReglage
        libelle={T.notifications}
        {...(enDemo
          ? { aide: T.indisponible }
          : permission === null
            ? { aide: T.nonSupporte }
            : {})}
        controle={
          abonne === null ? (
            <Bouton
              type="button"
              variante="secondaire"
              disabled={
                enDemo || cleVapid === undefined || permission === null || permission === 'denied'
              }
              onClick={demander}
            >
              {T.activer}
            </Bouton>
          ) : (
            <Bouton
              type="button"
              variante="secondaire"
              chargement={retrait.isPending}
              onClick={desactiver}
            >
              {T.desactiver}
            </Bouton>
          )
        }
      />
      {retrait.isError && <p className="texte-petit-14">{T.desactivationEchouee}</p>}
      {!enDemo && permission === 'granted' && <p className="texte-petit-14">{T.autorisees}</p>}
      {(abonnement.isError || echec) && <p className="texte-petit-14">{T.abonnementEchoue}</p>}
      {!enDemo && permission === 'default' && sansChoix && (
        <p className="texte-petit-14">{T.sansChoix}</p>
      )}
      {!enDemo && permission === 'denied' && <p className="texte-petit-14">{T.refusees}</p>}
      <div className={styles['reglage']}>
        <LigneReglage
          libelle={T.heure}
          controle={
            <ChampHeure
              libelle={T.heure}
              libelleMasque
              valeur={reglages.heureRappel}
              onChange={(heure) => {
                enregistrer({ heureRappel: heure })
              }}
            />
          }
        />
        <p className={`${styles['defaut'] ?? ''} texte-legende-12`}>
          {TP.parDefaut(DEFAUTS.heureRappel)}
          {reglages.heureRappel !== DEFAUTS.heureRappel && (
            <Bouton
              type="button"
              variante="texte"
              onClick={() => {
                enregistrer({ heureRappel: DEFAUTS.heureRappel })
              }}
            >
              {TP.revenir}
            </Bouton>
          )}
        </p>
      </div>
      <div className={styles['reglage']}>
        <LigneReglage
          libelle={T.pause}
          {...(pause === null ? { aide: T.aucunePause } : {})}
          controle={
            <ChampDate
              libelle={T.pause}
              libelleMasque
              valeur={pause ?? ''}
              aujourdhui={jourLocal(reglages.fuseau)}
              texteVide={T.choisirDate}
              onChange={(date) => {
                enregistrer({ rappelsEnPauseJusquAu: date || null })
              }}
            />
          }
        />
        {pause !== null && (
          <p className={`${styles['defaut'] ?? ''} texte-legende-12`}>
            <Bouton
              type="button"
              variante="texte"
              onClick={() => {
                enregistrer({ rappelsEnPauseJusquAu: null })
              }}
            >
              {T.reprendre}
            </Bouton>
          </p>
        )}
      </div>
    </>
  )
}
