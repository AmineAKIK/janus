import { ROUTES } from '@janus/contrats'
import type { SortieRoute, TacheDuJour } from '@janus/contrats'
import {
  BandeauAlerte,
  BarreProgression,
  Bouton,
  CarteZone,
  EnTeteJour,
  LigneAFaire,
  NoeudBloc,
} from '@janus/ui'
import { useLecture } from '../api/requetes.tsx'
import { Chargement, Erreur } from '../catalogue/EtatEcran.tsx'
import { LegendeStatuts } from '../catalogue/RepartitionStatuts.tsx'
import styles from './Aujourdhui.module.css'
import {
  dateLongue,
  TEXTES_AUJOURDHUI as T,
  texteEtape,
  texteNombreTaches,
  texteRetour,
  texteTache,
} from './textes.ts'

/** Les liens de l'appli sont des chemins du routeur à adresse en `#`. */
const adresse = (lien: string) => `#${lien}`

function BoutonLien({ lien, children }: { readonly lien: string; readonly children: string }) {
  return (
    <Bouton variante="principal" type="button" onClick={() => void (window.location.hash = lien)}>
      {children}
    </Bouton>
  )
}

function Corps({ donnees }: { readonly donnees: SortieRoute<(typeof ROUTES)['GET /aujourdhui']> }) {
  const { jour, retour, premiere_connexion: premiere, taches, module } = donnees
  const titreBloc = (code: string) =>
    module?.blocs.find(({ bloc }) => bloc === code)?.titre_court ?? ''
  const restantes = taches.filter(({ faite }) => !faite)
  const faites = taches.length - restantes.length
  const prochaine: TacheDuJour | undefined = restantes[0]
  const suite = restantes.slice(1)
  const enCours = module?.blocs.find(({ statut }) => statut === 'en_cours')
  const lienBlocEnCours = enCours === undefined ? '/' : `/blocs/${enCours.bloc}`

  if (premiere) {
    const premier = module?.blocs[0]
    return (
      <>
        <section className={styles['carte']}>
          <h2 className="texte-sous-titre-18">
            {premier === undefined
              ? T.titreEcran
              : `Commencer ${premier.bloc} ${premier.titre_court}`}
          </h2>
          <p className="texte-corps-16">{T.chaqueBloc}</p>
          {prochaine !== undefined && (
            <BoutonLien lien={prochaine.lien}>{T.commencerPremier}</BoutonLien>
          )}
        </section>
      </>
    )
  }

  return (
    <>
      {retour !== undefined && (
        <BandeauAlerte type="info">{texteRetour(retour.jours)}</BandeauAlerte>
      )}
      <EnTeteJour date={dateLongue(jour)} resume={texteNombreTaches(faites, taches.length)} />
      {prochaine === undefined ? (
        <section className={styles['carte']}>
          <p className="texte-corps-16">{T.toutFait}</p>
          <div className={styles['actions']}>
            <BoutonLien lien={lienBlocEnCours}>{T.avancer}</BoutonLien>
            <Bouton
              variante="secondaire"
              type="button"
              onClick={() => void (window.location.hash = '/journal')}
            >
              {T.voirJournal}
            </Bouton>
          </div>
        </section>
      ) : (
        <section className={styles['carte']}>
          <p className={`${styles['type'] ?? ''} texte-legende-12`}>
            {texteEtape(faites + 1, taches.length)}
          </p>
          <h2 className="texte-sous-titre-18">
            {texteTache(prochaine.tache, titreBloc, jour).titre}
          </h2>
          <p className={`${styles['complement'] ?? ''} texte-petit-14`}>
            {texteTache(prochaine.tache, titreBloc, jour).type}
          </p>
          <BarreProgression
            valeur={faites}
            max={taches.length}
            libelle={T.progression}
            texteValeur={`${String(faites)} sur ${String(taches.length)}`}
          />
          <BoutonLien lien={prochaine.lien}>{faites === 0 ? T.commencer : T.continuer}</BoutonLien>
        </section>
      )}
      {suite.length > 0 && (
        <CarteZone titre={T.auProgramme}>
          <ul className={styles['liste']}>
            {suite.map((element, index) => {
              const texte = texteTache(element.tache, titreBloc, jour)
              return (
                <li key={index}>
                  <LigneAFaire
                    type={texte.type}
                    bloc={texte.titre}
                    echeance={texte.complement}
                    prioritaire={element.tache.type === 'reprendre_erreur'}
                    lien={(proprietes) => <a href={adresse(element.lien)} {...proprietes} />}
                  />
                </li>
              )
            })}
          </ul>
        </CarteZone>
      )}
      {module !== null && (
        <CarteZone
          titre={T.votreModule}
          action={<a href={adresse('/tableau-de-bord')}>{T.voirTableau}</a>}
        >
          <ul className={styles['grille']} aria-label={T.grille}>
            {module.blocs.map((bloc) => (
              <li key={bloc.bloc}>
                <NoeudBloc
                  code={bloc.bloc}
                  libelle={bloc.titre_court}
                  statut={bloc.statut}
                  lien={(proprietes) => <a href={adresse(`/blocs/${bloc.bloc}`)} {...proprietes} />}
                />
              </li>
            ))}
          </ul>
          <LegendeStatuts titre={T.legende} />
        </CarteZone>
      )}
    </>
  )
}

export function PageAujourdhui() {
  const lecture = useLecture(ROUTES['GET /aujourdhui'], {})
  let contenu
  if (lecture.isError) contenu = <Erreur reessayer={() => void lecture.refetch()} />
  else if (lecture.isPending) contenu = <Chargement nombre={2} />
  else contenu = <Corps donnees={lecture.data} />
  return (
    <div className={styles['page']}>
      <h1 tabIndex={-1} className={`${styles['titre'] ?? ''} texte-titre-28`}>
        {T.titreEcran}
      </h1>
      {contenu}
    </div>
  )
}
