import { BarreProgression, Bouton, CarteZone, EtatVideZone, LIBELLES_STATUT } from '@janus/ui'
import { texteJourCourt } from '../revision/textes.ts'
import { texteTache } from '../aujourdhui/textesTaches.ts'
import styles from './Suivi.module.css'
import {
  TEXTES_SUIVI as T,
  texteAFaire,
  texteBudget,
  texteErreur,
  texteForce,
  texteSansPrerequis,
} from './textes.ts'
import type { DonneesSuivi } from './useSuivi.ts'

const adresse = (lien: string) => `#${lien}`
const jour = (instant: string) => texteJourCourt(instant.slice(0, 10))
const sousTitre = 'texte-petit-14'

function SousTitre({ children }: { readonly children: string }) {
  return <p className={`${styles['complement'] ?? ''} ${sousTitre}`}>{children}</p>
}

function lienBloc(code: string, contenu: string) {
  return <a href={adresse(`/blocs/${code}`)}>{contenu}</a>
}

export function ZoneAFaire({
  donnees,
  titreBloc,
}: {
  readonly donnees: DonneesSuivi['a_faire']
  readonly titreBloc: (code: string) => string
}) {
  const { aujourdhui, a_venir: aVenir, taches } = donnees
  return (
    <CarteZone titre={T.aFaire} action={<a href={adresse('/')}>{T.toutVoir}</a>}>
      {taches.length === 0 && aujourdhui === 0 && aVenir === 0 ? (
        <EtatVideZone message={T.vide} />
      ) : (
        <>
          <SousTitre>{texteAFaire(aujourdhui, aVenir)}</SousTitre>
          <ul className={styles['liste']}>
            {taches.map((element, index) => {
              const texte = texteTache(element.tache, { titreBloc, etape: () => null })
              return (
                <li key={index}>
                  <a href={adresse(element.lien)}>{texte.titre}</a>{' '}
                  <span className={styles['complement']}>{texte.complement}</span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </CarteZone>
  )
}

export function ZoneErreurs({ erreurs }: { readonly erreurs: DonneesSuivi['erreurs'] }) {
  return (
    <CarteZone titre={T.erreurs}>
      {erreurs.length === 0 ? (
        <EtatVideZone message={T.vide} />
      ) : (
        <>
          <SousTitre>{T.erreursSousTitre}</SousTitre>
          <ul className={styles['liste']}>
            {erreurs.map((erreur) => (
              <li key={erreur.erreur}>
                {erreur.blocs.length === 1 && erreur.blocs[0] !== undefined ? (
                  lienBloc(
                    erreur.blocs[0],
                    texteErreur(erreur.libelle, erreur.nombre, erreur.blocs),
                  )
                ) : (
                  <>
                    <span>{texteErreur(erreur.libelle, erreur.nombre, [])}</span>
                    {erreur.blocs.map((code) => (
                      <span key={code}> {lienBloc(code, code)}</span>
                    ))}
                  </>
                )}
                {erreur.ouverte && <span className={styles['badge']}> {T.aReprendre}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </CarteZone>
  )
}

export function ZoneDecisions({
  decisions,
  actifs,
  surForcer,
  surLever,
}: {
  readonly decisions: DonneesSuivi['decisions']
  /** Les blocs dont le statut est forcé en ce moment. */
  readonly actifs: ReadonlySet<string>
  readonly surForcer: () => void
  readonly surLever: (bloc: string) => void
}) {
  const { forces, sans_prerequis: sans } = decisions
  return (
    <CarteZone
      titre={T.decisions}
      action={
        <Bouton variante="secondaire" type="button" onClick={surForcer}>
          {T.forcer}
        </Bouton>
      }
    >
      {forces.length === 0 && sans.length === 0 ? (
        <EtatVideZone message={T.vide} />
      ) : (
        <>
          <SousTitre>{T.decisionsSousTitre}</SousTitre>
          <ul className={styles['liste']}>
            {forces.map((force, rang) => (
              <li key={`${force.bloc}-${force.date}`}>
                {lienBloc(
                  force.bloc,
                  texteForce(jour(force.date), force.bloc, LIBELLES_STATUT[force.statut]),
                )}
                <br />
                <span className={styles['complement']}>Raison : {force.raison}</span>{' '}
                {actifs.has(force.bloc) &&
                  forces.findIndex(({ bloc }) => bloc === force.bloc) === rang && (
                    <Bouton
                      variante="texte"
                      type="button"
                      onClick={() => {
                        surLever(force.bloc)
                      }}
                    >
                      {T.revenir}
                      <span className={styles['cache']}>{` ${force.bloc}`}</span>
                    </Bouton>
                  )}
              </li>
            ))}
          </ul>
          {sans.length > 0 && (
            <>
              <p className={`${styles['sousSection'] ?? ''} texte-legende-12`}>{T.sansPrerequis}</p>
              <ul className={styles['liste']}>
                {sans.map((ouverture) => (
                  <li key={`${ouverture.bloc}-${ouverture.date}`}>
                    {lienBloc(
                      ouverture.bloc,
                      texteSansPrerequis(jour(ouverture.date), ouverture.bloc),
                    )}
                    {ouverture.raison !== null && (
                      <>
                        <br />
                        <span className={styles['complement']}>Raison : {ouverture.raison}</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </CarteZone>
  )
}

export function ZoneCout({ cout }: { readonly cout: DonneesSuivi['cout_ia'] }) {
  const { depense_millioniemes: depense, plafond_millioniemes: plafond } = cout
  const alerte = plafond > 0 && depense / plafond > 0.8
  return (
    <CarteZone titre={T.cout}>
      <div className={alerte ? styles['alerte'] : undefined}>
        <BarreProgression
          valeur={depense}
          max={plafond}
          libelle={T.budget}
          texteValeur={texteBudget(depense, plafond)}
        />
      </div>
    </CarteZone>
  )
}
