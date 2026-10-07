import type { ModificationReglages, Reglages } from '@janus/contrats'
import { Bouton, ChampTexte, LigneReglage } from '@janus/ui'
import { useState } from 'react'
import { modeTransport } from '../../api/client.ts'
import styles from '../Parametres.module.css'
import { TEXTES_PARAMETRES as TP, TEXTES_RAPPELS as T } from '../textes.ts'

const DEFAUTS = { heureRappel: '19:00' } as const
const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/

interface Proprietes {
  readonly reglages: Reglages
  readonly enregistrer: (corps: ModificationReglages) => void
}

/** Le navigateur sait-il demander l'autorisation d'afficher des notifications ? */
const permissionConnue = () => typeof Notification !== 'undefined'

export function SectionRappels({ reglages, enregistrer }: Proprietes) {
  const enDemo = modeTransport(import.meta.env.VITE_TRANSPORT) === 'demo'
  const [permission, setPermission] = useState<NotificationPermission | null>(
    permissionConnue() ? Notification.permission : null,
  )
  const [heure, setHeure] = useState<string | null>(null)

  function validerHeure() {
    if (heure === null) return
    setHeure(null)
    if (HEURE.test(heure) && heure !== reglages.heureRappel) enregistrer({ heureRappel: heure })
  }

  function demander() {
    void Notification.requestPermission().then(setPermission)
  }

  const pause = reglages.rappelsEnPauseJusquAu
  return (
    <>
      <p className="texte-corps-16">{T.introduction}</p>
      <LigneReglage
        libelle={T.notifications}
        {...(enDemo ? { aide: T.indisponible } : {})}
        controle={
          <Bouton
            type="button"
            variante="secondaire"
            disabled={enDemo || permission === null || permission === 'granted'}
            onClick={demander}
          >
            {T.activer}
          </Bouton>
        }
      />
      {!enDemo && permission === 'granted' && <p className="texte-petit-14">{T.autorisees}</p>}
      {!enDemo && permission === 'denied' && <p className="texte-petit-14">{T.refusees}</p>}
      <div className={styles['reglage']}>
        <LigneReglage
          libelle={T.heure}
          controle={
            <ChampTexte
              libelle={T.heure}
              type="time"
              value={heure ?? reglages.heureRappel}
              onChange={(evenement) => {
                setHeure(evenement.target.value)
              }}
              onBlur={validerHeure}
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
                setHeure(null)
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
            <ChampTexte
              libelle={T.pause}
              type="date"
              value={pause ?? ''}
              onChange={(evenement) => {
                enregistrer({ rappelsEnPauseJusquAu: evenement.target.value || null })
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
