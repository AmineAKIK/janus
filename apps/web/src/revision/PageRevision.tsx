import { ROUTES } from '@janus/contrats'
import { ecartEnJours, jourDe } from '@janus/moteur'
import { BarreProgression, Bouton, Dialogue, TexteCarte } from '@janus/ui'
import { useEffect, useState } from 'react'
import { useLecture } from '../api/requetes.tsx'
import { texteTache } from '../aujourdhui/textesTaches.ts'
import { Chargement, Erreur } from '../catalogue/EtatEcran.tsx'
import { texteEtapeSuivante } from '../questions/textes.ts'
import styles from './Revision.module.css'
import {
  NOTES,
  TEXTES_REVISION as T,
  texteBandeau,
  texteCartesRevues,
  texteIntervalle,
  texteProchaine,
  texteDontNouvelles,
  texteRang,
  texteRepartition,
  texteReviennentDans,
} from './textes.ts'
import { useRevision } from './useRevision.ts'

const ESPACE = ' '

function dansUnChamp(cible: EventTarget | null): boolean {
  return (
    cible instanceof HTMLElement &&
    (['INPUT', 'TEXTAREA', 'SELECT'].includes(cible.tagName) || cible.isContentEditable)
  )
}

export function PageRevision() {
  const revision = useRevision()
  const aujourdhui = useLecture(ROUTES['GET /aujourdhui'], {})
  const reglages = useLecture(ROUTES['GET /reglages'], {})
  const [quitter, setQuitter] = useState(false)
  const { carte, verso, phase, noter, montrerReponse } = revision

  useEffect(() => {
    if (quitter) return
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.ctrlKey || evenement.metaKey || evenement.altKey) return
      if (dansUnChamp(evenement.target)) return
      if (evenement.key === 'Escape') {
        setQuitter(true)
        return
      }
      if (carte === undefined || phase !== 'prete') return
      if (evenement.key === ESPACE && !verso) {
        evenement.preventDefault()
        montrerReponse()
        return
      }
      const rang = Number(evenement.key)
      const choix = verso && rang >= 1 && rang <= NOTES.length ? NOTES[rang - 1] : undefined
      if (choix !== undefined) noter(choix.note)
    }
    document.addEventListener('keydown', surTouche)
    return () => {
      document.removeEventListener('keydown', surTouche)
    }
  }, [quitter, carte, verso, phase, noter, montrerReponse])

  const suivante = aujourdhui.data?.taches.find(
    ({ tache, faite }) => !faite && tache.type !== 'cartes',
  )
  const titreBloc = (code: string) =>
    aujourdhui.data?.module?.blocs.find(({ bloc }) => bloc === code)?.titre_court ?? ''
  const allerALEtapeSuivante = () => {
    revision.vider()
    window.location.hash = suivante?.lien ?? '/'
  }
  const etapeSuivante = (
    <Bouton type="button" variante="principal" onClick={allerALEtapeSuivante}>
      {suivante === undefined
        ? T.etapeSuivante
        : texteEtapeSuivante(texteTache(suivante.tache, { titreBloc, etape: () => null }).titre)}
    </Bouton>
  )

  const total = revision.cartes.length
  let contenu
  if (phase === 'erreur') contenu = <Erreur reessayer={revision.recharger} />
  else if (phase === 'chargement') contenu = <Chargement nombre={2} />
  else if (total === 0) {
    const jour = aujourdhui.data?.jour
    const prochaine =
      revision.prochaine === null || jour === undefined || reglages.data === undefined
        ? null
        : jourDe(revision.prochaine, reglages.data.fuseau, reglages.data.heureBascule)
    contenu = (
      <section className={styles['fin']}>
        <p className="texte-sous-titre-18">{T.aucune}</p>
        {prochaine !== null && jour !== undefined && (
          <p className="texte-corps-16">
            {texteProchaine(prochaine, ecartEnJours(jour, prochaine))}
          </p>
        )}
        {etapeSuivante}
      </section>
    )
  } else if (carte === undefined) {
    const { aRevoir, bientot, revues } = revision
    if (bientot.length > 0) {
      const delai = Math.min(...bientot.map(({ carte: revue }) => revue.apercu.a_revoir))
      contenu = (
        <section className={styles['fin']}>
          <h2 className="texte-sous-titre-18">{T.cartesARevoir}</h2>
          <p className="texte-corps-16">
            {texteReviennentDans(bientot.length, texteIntervalle(delai))}
          </p>
          <p className="texte-corps-16">{T.reviennentAvant}</p>
          <p className="texte-corps-16">{T.revoirOuPlusTard}</p>
          <div className={styles['actions']}>
            <Bouton type="button" variante="principal" onClick={revision.revoirMaintenant}>
              {T.revoirMaintenant}
            </Bouton>
            <Bouton type="button" variante="secondaire" onClick={allerALEtapeSuivante}>
              {T.plusTard}
            </Bouton>
          </div>
        </section>
      )
    } else {
      contenu = (
        <section className={styles['fin']}>
          <h2 className="texte-sous-titre-18">{texteCartesRevues(revues.length)}</h2>
          <p className="texte-corps-16">{texteRepartition(revues)}</p>
          {aRevoir.length > 0 && <p className="texte-corps-16">{T.reviennentBientot}</p>}
          {etapeSuivante}
        </section>
      )
    }
  } else {
    contenu = (
      <section className={styles['carte']}>
        <div className={styles['defilement']}>
          {carte.nouvelle && (
            <span className={`${styles['badge'] ?? ''} texte-legende-12`}>{T.nouvelle}</span>
          )}
          <p className={`${styles['code'] ?? ''} texte-legende-12`}>{carte.bloc}</p>
          <TexteCarte texte={carte.recto} />
          {verso && (
            <>
              <hr className={styles['separateur']} />
              <TexteCarte texte={carte.verso} />
            </>
          )}
        </div>
        <div className={styles['actions']}>
          {verso ? (
            NOTES.map(({ note, libelle }, index) => (
              <Bouton
                key={note}
                type="button"
                variante={note === 'bien' ? 'principal' : 'secondaire'}
                aria-keyshortcuts={String(index + 1)}
                onClick={() => {
                  noter(note)
                }}
              >
                <span className={styles['note']}>
                  {libelle}{' '}
                  <small className="texte-legende-12">{texteIntervalle(carte.apercu[note])}</small>
                </span>
              </Bouton>
            ))
          ) : (
            <Bouton
              type="button"
              variante="principal"
              aria-keyshortcuts="Space"
              onClick={montrerReponse}
            >
              {T.voirReponse}
            </Bouton>
          )}
        </div>
      </section>
    )
  }

  const { annulable } = revision
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
          {T.titre}
        </h1>
        {total > 0 && carte !== undefined && (
          <div className={styles['rang']}>
            <BarreProgression
              valeur={revision.position + 1}
              max={total}
              libelle={T.progression}
              texteValeur={texteRang(revision.position + 1, total)}
            />
            <p className="texte-petit-14">{texteDontNouvelles(revision.nouvelles)}</p>
          </div>
        )}
      </header>
      {contenu}
      {annulable !== null && (
        <div role="status" className={styles['bandeau']}>
          <span className="texte-petit-14">
            {texteBandeau(annulable.note, texteIntervalle(annulable.carte.apercu[annulable.note]))}
          </span>
          <Bouton type="button" variante="texte" onClick={revision.annuler}>
            {T.annuler}
          </Bouton>
        </div>
      )}
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
                revision.vider()
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
