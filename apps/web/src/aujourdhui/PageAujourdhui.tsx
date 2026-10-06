import { ROUTES } from '@janus/contrats'
import type { SortieRoute } from '@janus/contrats'
import {
  BandeauAlerte,
  BarreProgression,
  Bouton,
  CarteZone,
  ChevronRight,
  EnTeteJour,
  NoeudBloc,
} from '@janus/ui'
import { useLecture, useLectures } from '../api/requetes.tsx'
import { rangEtape } from '../catalogue/useBlocs.ts'
import { Chargement, Erreur } from '../catalogue/EtatEcran.tsx'
import { LegendeStatuts } from '../catalogue/RepartitionStatuts.tsx'
import styles from './Aujourdhui.module.css'
import {
  dateLongue,
  TEXTES_AUJOURDHUI as T,
  texteBlocsAcquis,
  texteEtape,
  texteNombreTaches,
  texteProgression,
  texteRetour,
} from './textes.ts'
import { texteTache } from './textesTaches.ts'

type Donnees = SortieRoute<(typeof ROUTES)['GET /aujourdhui']>

/** Les liens de l'appli sont des chemins du routeur à adresse en `#`. */
const adresse = (lien: string) => `#${lien}`

function allerA(lien: string) {
  window.location.hash = lien
}

function Corps({ donnees }: { readonly donnees: Donnees }) {
  const { jour, retour, premiere_connexion: premiere, taches, module } = donnees
  const blocEnCours = taches.find(({ tache }) => tache.type === 'bloc')?.tache
  const details = useLectures(
    ROUTES['GET /blocs/:id'],
    blocEnCours?.type === 'bloc' ? [{ params: { id: blocEnCours.bloc } }] : [],
  )
  const detail = details[0]?.data

  const titreBloc = (code: string) =>
    module?.blocs.find(({ bloc }) => bloc === code)?.titre_court ?? ''
  const etapeDe = (code: string) =>
    detail === undefined || blocEnCours?.type !== 'bloc' || blocEnCours.bloc !== code
      ? null
      : rangEtape(detail.etat_page?.etat, detail.manifeste.etapes)
  const textes = { titreBloc, etape: etapeDe }

  const restantes = taches.filter(({ faite }) => !faite)
  const faites = taches.length - restantes.length
  const prochaine = restantes[0]
  const enCours = module?.blocs.find(({ statut }) => statut === 'en_cours')
  const lienBlocEnCours = enCours === undefined ? '/' : `/blocs/${enCours.bloc}`

  let principal
  if (premiere) {
    const premier = module?.blocs[0]
    principal = (
      <section className={styles['carte']}>
        <h2 className="texte-sous-titre-18">
          {premier === undefined
            ? T.titreEcran
            : `${T.commencerPremier} ${premier.bloc} ${premier.titre_court}`}
        </h2>
        <p className="texte-corps-16">{T.chaqueBloc}</p>
        {prochaine !== undefined && (
          <Bouton
            variante="principal"
            type="button"
            onClick={() => {
              allerA(prochaine.lien)
            }}
          >
            {T.commencerPremier}
          </Bouton>
        )}
      </section>
    )
  } else if (prochaine === undefined) {
    principal = (
      <section className={styles['carte']}>
        <p className="texte-corps-16">{T.toutFait}</p>
        <div className={styles['actions']}>
          <Bouton
            variante="principal"
            type="button"
            onClick={() => {
              allerA(lienBlocEnCours)
            }}
          >
            {T.avancer}
          </Bouton>
          <Bouton
            variante="secondaire"
            type="button"
            onClick={() => {
              allerA('/journal')
            }}
          >
            {T.voirJournal}
          </Bouton>
        </div>
      </section>
    )
  } else {
    const texte = texteTache(prochaine.tache, textes)
    principal = (
      <section className={styles['carte']}>
        <p className={`${styles['type'] ?? ''} texte-legende-12`}>
          {texteEtape(faites + 1, taches.length)}
        </p>
        <h2 className="texte-sous-titre-18">{texte.titre}</h2>
        <p className={`${styles['complement'] ?? ''} texte-petit-14`}>{texte.texte}</p>
        <BarreProgression
          valeur={faites}
          max={taches.length}
          libelle={T.progression}
          texteValeur={texteProgression(faites, taches.length)}
        />
        <Bouton
          variante="principal"
          type="button"
          onClick={() => {
            allerA(prochaine.lien)
          }}
        >
          {faites === 0 ? T.commencer : T.continuer}
        </Bouton>
      </section>
    )
  }

  const acquis = (module?.blocs ?? []).filter(({ statut }) =>
    ['acquis', 'maitrise'].includes(statut),
  ).length

  return (
    <div className={styles['colonnes']}>
      <div className={styles['colonne']}>
        {retour !== undefined && (
          <BandeauAlerte type="info">{texteRetour(retour.jours)}</BandeauAlerte>
        )}
        <EnTeteJour date={dateLongue(jour)} resume={texteNombreTaches(faites, taches.length)} />
        {principal}
        {!premiere && taches.length > 0 && (
          <CarteZone titre={T.auProgramme}>
            <ol className={styles['liste']}>
              {taches.map((element, index) => {
                const texte = texteTache(element.tache, textes)
                return (
                  <li key={index}>
                    <a
                      href={adresse(element.lien)}
                      className={`${styles['rangee'] ?? ''} ${element.faite ? (styles['faite'] ?? '') : ''}`}
                    >
                      <span
                        className={`${styles['rang'] ?? ''} texte-legende-12`}
                        aria-hidden="true"
                      >
                        {element.faite ? '✓' : String(index + 1)}
                      </span>
                      <span className={`${styles['rangeeTitre'] ?? ''} texte-petit-14`}>
                        {texte.titre}
                        {element.faite && <span className={styles['cache']}>, faite</span>}
                      </span>
                      <span className={`${styles['rangeeComplement'] ?? ''} texte-legende-12`}>
                        {texte.complement}
                      </span>
                      <ChevronRight aria-hidden="true" className={styles['chevron']} />
                    </a>
                  </li>
                )
              })}
            </ol>
          </CarteZone>
        )}
      </div>
      {module !== null && (
        <aside className={styles['panneau']}>
          <CarteZone
            titre={T.votreModule}
            action={<a href={adresse('/tableau-de-bord')}>{T.voirTableau}</a>}
          >
            <p className={`${styles['complement'] ?? ''} texte-petit-14`}>
              {texteBlocsAcquis(acquis, module.blocs.length)}
            </p>
            <ul className={styles['grille']} aria-label={T.grille}>
              {module.blocs.map((bloc) => (
                <li key={bloc.bloc}>
                  <NoeudBloc
                    code={bloc.bloc}
                    libelle={bloc.titre_court}
                    statut={bloc.statut}
                    lien={(proprietes) => (
                      <a href={adresse(`/blocs/${bloc.bloc}`)} {...proprietes} />
                    )}
                  />
                </li>
              ))}
            </ul>
            <LegendeStatuts titre={T.legende} />
          </CarteZone>
        </aside>
      )}
    </div>
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
