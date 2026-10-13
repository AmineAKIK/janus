import { ROUTES, nouvelId } from '@janus/contrats'
import { Bouton, DialogueConfirmation } from '@janus/ui'
import { useState } from 'react'
import { useLecture } from '../api/requetes.tsx'
import { Chargement, Erreur } from '../catalogue/EtatEcran.tsx'
import { useBoiteEnvoi } from '../envoi/FournisseurEnvoi.tsx'
import { instantReel } from '../horloge.ts'
import { aller } from '../routes/navigation.ts'
import { DialogueQuitterSeance } from '../seance/DialogueQuitterSeance.tsx'
import { EnteteSeance } from '../seance/EnteteSeance.tsx'
import { etapeSuivante } from '../seance/etapeSuivante.ts'
import type { Aujourdhui } from '../seance/etapeSuivante.ts'
import seance from '../seance/Seance.module.css'
import { PartieTache, PartieTexte } from './Parties.tsx'
import { Resultat } from './Resultat.tsx'
import { LIBELLES_PARTIE, TEXTES_VERIFICATION as T, texteEnTete, texteRevuLe } from './textes.ts'
import styles from './Verification.module.css'
import { useVerification } from './useVerification.ts'

function EtapeSuivante({
  aujourdhui,
  lienCourant,
}: {
  readonly aujourdhui: Aujourdhui | undefined
  /** Le lien de la file du jour qui mène à cette vérification : elle ne se propose pas à elle-même. */
  readonly lienCourant: string
}) {
  const suivante = etapeSuivante(aujourdhui, ({ lien }) => lien === lienCourant)
  return (
    <Bouton
      type="button"
      variante="principal"
      onClick={() => {
        aller(suivante.lien)
      }}
    >
      {suivante.libelle}
    </Bouton>
  )
}

export function PageVerification({ id }: { readonly id: string }) {
  const verification = useVerification(id)
  const aujourdhui = useLecture(ROUTES['GET /aujourdhui'], {})
  const boite = useBoiteEnvoi()
  const [quitter, setQuitter] = useState(false)
  const [lance, setLance] = useState(false)
  const [quandMeme, setQuandMeme] = useState(false)
  const [reportDemande, setReportDemande] = useState(false)
  const { phase, vue, parties, courante, resultat } = verification

  const reporter = () => {
    const message = nouvelId(Date.parse(instantReel()))
    void boite.ajouter({
      id: message,
      route: 'POST /verifications/:id/reporter',
      params: { id },
      corps: { id: message },
    })
    aller('/')
  }

  let contenu
  if (phase === 'erreur')
    contenu = <Erreur reessayer={verification.recharger} introuvable={verification.introuvable} />
  else if (phase === 'chargement' || vue === undefined) contenu = <Chargement nombre={2} />
  else if (resultat !== null) {
    contenu = (
      <Resultat
        resultat={resultat}
        etapeSuivante={
          <EtapeSuivante
            aujourdhui={aujourdhui.data}
            lienCourant={`/verifications/ouvrir/${resultat.bloc.code}/${vue.type}`}
          />
        }
      />
    )
  } else if (
    courante === undefined ||
    (verification.etat(courante) === 'envoi' && courante === parties.at(-1))
  ) {
    const lecture = parties.filter(({ type }) => type !== 'tache')
    contenu = (
      <section className={seance['colonne']} aria-busy="true">
        <h2 className="texte-sous-titre-18" role="status">
          {T.correctionEnCours}
        </h2>
        <p className="texte-corps-16">{T.correctionAttente}</p>
        {lecture.map(({ id: partie, type }) => (
          <p key={partie} className={`${styles['lecture'] ?? ''} texte-petit-14`}>
            <strong>{LIBELLES_PARTIE[type]}</strong>
            <br />
            {verification.saisies[partie]?.reponse ?? ''}
          </p>
        ))}
      </section>
    )
  } else if (!verification.commencee && !lance && !quandMeme) {
    if (vue.revu_recemment !== null) {
      contenu = (
        <section className={seance['colonne']}>
          <h2 className="texte-sous-titre-18">{T.revuTitre}</h2>
          <p className="texte-corps-16">{texteRevuLe(vue.revu_recemment)}</p>
          <p className="texte-corps-16">{T.revuExplication}</p>
          <div className={styles['actions']}>
            <Bouton
              type="button"
              variante="principal"
              onClick={() => {
                setReportDemande(true)
              }}
            >
              {T.reporter}
            </Bouton>
            <Bouton
              type="button"
              variante="secondaire"
              onClick={() => {
                setQuandMeme(true)
              }}
            >
              {T.faireQuandMeme}
            </Bouton>
          </div>
        </section>
      )
    } else {
      contenu = (
        <section className={seance['colonne']}>
          <h2 className="texte-sous-titre-18">{T.introTitre}</h2>
          <p className="texte-corps-16">{T.introAnonyme}</p>
          <p className="texte-petit-14">{T.introResume}</p>
          <p className="texte-corps-16">{T.introConsigne}</p>
          <div className={styles['actions']}>
            <Bouton
              type="button"
              variante="principal"
              onClick={() => {
                setLance(true)
              }}
            >
              {T.commencer}
            </Bouton>
          </div>
        </section>
      )
    }
  } else {
    const etat = verification.etat(courante)
    const proprietes = {
      partie: courante,
      enAttente: etat === 'envoi',
      indisponible: etat === 'indisponible',
      envoyer: (saisie: Parameters<typeof verification.envoyer>[1]) => {
        verification.envoyer(courante, saisie)
      },
    }
    const precedente = parties[parties.indexOf(courante) - 1]
    contenu = (
      <section className={seance['colonne']}>
        {precedente !== undefined && verification.etat(precedente) === 'envoyee' && (
          <p role="status" className={`${seance['secondaire'] ?? ''} texte-petit-14`}>
            {T.reponseEnregistree}
          </p>
        )}
        {courante.type === 'tache' ? (
          <PartieTache key={courante.id} {...proprietes} />
        ) : (
          <PartieTexte key={courante.id} {...proprietes} />
        )}
      </section>
    )
  }

  return (
    <div className={seance['page']}>
      <EnteteSeance
        titre={vue === undefined ? T.titre : texteEnTete(vue.type)}
        colonnes={styles['colonnes']}
        surQuitter={() => {
          setQuitter(true)
        }}
      >
        {vue !== undefined && resultat === null && (
          <ol className={`${styles['parties'] ?? ''} texte-petit-14`} aria-label="Parties">
            {parties.map((partie, rang) => (
              <li
                key={partie.id}
                {...(partie.id === courante?.id ? { 'aria-current': 'step' as const } : {})}
              >
                {verification.etat(partie) === 'envoyee' ? '✓' : String(rang + 1)}{' '}
                {LIBELLES_PARTIE[partie.type]}
              </li>
            ))}
          </ol>
        )}
      </EnteteSeance>
      {contenu}
      {reportDemande && (
        <DialogueConfirmation
          titre={T.reporterTitre}
          libelleConfirmer={T.reporter}
          libelleAnnuler={T.annuler}
          surAnnuler={() => {
            setReportDemande(false)
          }}
          surConfirmer={reporter}
        >
          <p>{T.reporterMessage}</p>
        </DialogueConfirmation>
      )}
      {quitter && (
        <DialogueQuitterSeance
          titre={T.dialogueTitre}
          texte={T.dialogueTexte}
          surSortie={() => {
            aller('/')
          }}
          surContinuer={() => {
            setQuitter(false)
          }}
        />
      )}
    </div>
  )
}
