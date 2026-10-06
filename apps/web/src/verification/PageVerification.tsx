import { ROUTES } from '@janus/contrats'
import type { SortieRoute } from '@janus/contrats'
import { Bouton, Dialogue } from '@janus/ui'
import { useState } from 'react'
import { useLecture } from '../api/requetes.tsx'
import { texteTache } from '../aujourdhui/textesTaches.ts'
import { Chargement, Erreur } from '../catalogue/EtatEcran.tsx'
import { useBoiteEnvoi } from '../envoi/FournisseurEnvoi.tsx'
import { texteEtapeSuivante } from '../questions/textes.ts'
import { nouvelId } from '@janus/contrats'
import { instantReel } from '../demo/horlogeDemo.ts'
import { PartieTache, PartieTexte } from './Parties.tsx'
import { Resultat } from './Resultat.tsx'
import { LIBELLES_PARTIE, TEXTES_VERIFICATION as T, texteEnTete, texteRevuLe } from './textes.ts'
import styles from './Verification.module.css'
import { useVerification } from './useVerification.ts'

type Aujourdhui = SortieRoute<(typeof ROUTES)['GET /aujourdhui']>

function EtapeSuivante({
  aujourdhui,
  idVerification,
}: {
  readonly aujourdhui: Aujourdhui | undefined
  readonly idVerification: string
}) {
  const suivante = aujourdhui?.taches.find(
    ({ faite, lien }) => !faite && lien !== `/verifications/${idVerification}`,
  )
  const titreBloc = (code: string) =>
    aujourdhui?.module?.blocs.find(({ bloc }) => bloc === code)?.titre_court ?? ''
  return (
    <Bouton
      type="button"
      variante="principal"
      onClick={() => {
        window.location.hash = suivante?.lien ?? '/'
      }}
    >
      {suivante === undefined
        ? T.etapeSuivante
        : texteEtapeSuivante(texteTache(suivante.tache, { titreBloc, etape: () => null }).titre)}
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
  const { phase, vue, parties, courante, resultat } = verification

  const reporter = () => {
    const message = nouvelId(Date.parse(instantReel()))
    void boite.ajouter({
      id: message,
      route: 'POST /verifications/:id/reporter',
      params: { id },
      corps: { id: message },
    })
    window.location.hash = '/'
  }

  let contenu
  if (phase === 'erreur') contenu = <Erreur reessayer={verification.recharger} />
  else if (phase === 'chargement' || vue === undefined) contenu = <Chargement nombre={2} />
  else if (resultat !== null) {
    contenu = (
      <Resultat
        resultat={resultat}
        etapeSuivante={<EtapeSuivante aujourdhui={aujourdhui.data} idVerification={id} />}
      />
    )
  } else if (
    courante === undefined ||
    (verification.etat(courante) === 'envoi' && courante === parties.at(-1))
  ) {
    const lecture = parties.filter(({ type }) => type !== 'tache')
    contenu = (
      <section className={styles['section']} aria-busy="true">
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
        <section className={styles['section']}>
          <h2 className="texte-sous-titre-18">{T.revuTitre}</h2>
          <p className="texte-corps-16">{texteRevuLe(vue.revu_recemment)}</p>
          <p className="texte-corps-16">{T.revuExplication}</p>
          <div className={styles['actions']}>
            <Bouton type="button" variante="principal" onClick={reporter}>
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
        <section className={styles['section']}>
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
      <section className={styles['section']}>
        {precedente !== undefined && verification.etat(precedente) === 'envoyee' && (
          <p role="status" className={`${styles['secondaire'] ?? ''} texte-petit-14`}>
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
    <div className={styles['page']}>
      <header className={styles['entete']}>
        <button
          type="button"
          className={`${styles['quitter'] ?? ''} texte-petit-14`}
          onClick={() => {
            setQuitter(true)
          }}
        >
          <span aria-hidden="true">×</span> {T.quitter}
        </button>
        <h1 tabIndex={-1} className={`${styles['titre'] ?? ''} texte-sous-titre-18`}>
          {vue === undefined ? T.titre : texteEnTete(vue.type)}
        </h1>
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
      </header>
      {contenu}
      {quitter && (
        <Dialogue
          titre={T.dialogueTitre}
          surFermeture={() => {
            setQuitter(false)
          }}
        >
          <p className="texte-corps-16">{T.dialogueTexte}</p>
          <div className={styles['actions']}>
            <Bouton
              type="button"
              variante="secondaire"
              onClick={() => {
                window.location.hash = '/'
              }}
            >
              {T.quitter}
            </Bouton>
            <Bouton
              type="button"
              variante="principal"
              data-focus-initial
              onClick={() => {
                setQuitter(false)
              }}
            >
              {T.continuer}
            </Bouton>
          </div>
        </Dialogue>
      )}
    </div>
  )
}
