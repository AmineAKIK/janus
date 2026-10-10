import {
  BadgeStatut,
  Dialogue,
  GroupeSegmente,
  ChevronRight,
  EtatVideZone,
  LockOpen,
} from '@janus/ui'
import { Link, useNavigate } from '@tanstack/react-router'
import styles from './Blocs.module.css'
import catalogue from './Catalogue.module.css'
import { useBureau } from '../parametres/useBureau.ts'
import { Chargement, Erreur } from './EtatEcran.tsx'
import { correspond, grouper, lireFiltre } from './filtre.ts'
import type { FiltreBlocs } from './filtre.ts'
import { PanneauDetail } from './PanneauDetail.tsx'
import { RepartitionStatuts } from './RepartitionStatuts.tsx'
import { TEXTES_BLOCS, texteBlocs, titreModule } from './textes.ts'
import { useBlocs } from './useBlocs.ts'
import type { BlocDeLaListe } from './useBlocs.ts'

function LigneBloc({
  bloc,
  moduleId,
  selectionne,
  statutFiltre,
}: {
  readonly bloc: BlocDeLaListe
  readonly moduleId: string
  readonly selectionne: boolean
  readonly statutFiltre: FiltreBlocs
}) {
  const { date, erreur, prerequis } = bloc.echeance
  return (
    <li className={styles['item']}>
      <Link
        to="/modules/$moduleId"
        params={{ moduleId }}
        search={{ detail: bloc.bloc, ...(statutFiltre === 'tous' ? {} : { statut: statutFiltre }) }}
        activeOptions={{ exact: true, includeSearch: true }}
        className={[
          styles['bloc'],
          selectionne ? styles['selectionne'] : '',
          erreur === null ? '' : styles['avecErreur'],
          bloc.grise ? styles['grise'] : '',
        ].join(' ')}
      >
        <BadgeStatut statut={bloc.statut} taille="compacte" />
        <span className={`${styles['code'] ?? ''} texte-code-14`}>{bloc.bloc}</span>
        <span className={styles['libelles']}>
          <span className="texte-petit-14">{bloc.titre}</span>
          {erreur !== null && (
            <span className={`${styles['erreur'] ?? ''} texte-legende-12`}>{erreur}</span>
          )}
          {prerequis === null && bloc.grise && bloc.statut !== 'non_commence' && (
            <span className={`${styles['prerequis'] ?? ''} texte-legende-12`}>
              <LockOpen aria-hidden="true" className={styles['cadenas']} />
              {TEXTES_BLOCS.ouvertSansPrerequis}
            </span>
          )}
          {prerequis !== null && (
            <span className={`${styles['prerequis'] ?? ''} texte-legende-12`}>
              <LockOpen aria-hidden="true" className={styles['cadenas']} />
              {prerequis}
            </span>
          )}
        </span>
        {date !== null && (
          <span className={`${styles['date'] ?? ''} texte-legende-12`}>{date}</span>
        )}
        <ChevronRight aria-hidden="true" className={styles['chevron']} />
      </Link>
    </li>
  )
}

export function PageBlocs({
  moduleId,
  statut,
  detail,
}: {
  readonly moduleId: string
  readonly statut: string | undefined
  readonly detail: string | undefined
}) {
  const navigate = useNavigate()
  const bureau = useBureau()
  const etat = useBlocs(moduleId)
  const filtre = lireFiltre(statut)

  let contenu
  let compteur = null
  let entete = (
    <h1 tabIndex={-1} className={`${catalogue['titre'] ?? ''} texte-titre-28`}>
      {TEXTES_BLOCS.titreParDefaut}
    </h1>
  )
  let filAriane = null
  if (etat.phase === 'erreur') {
    contenu = <Erreur reessayer={etat.reessayer} />
  } else if (etat.phase === 'chargement') {
    contenu = <Chargement nombre={4} />
  } else {
    const { module, blocs } = etat
    const groupes = grouper(blocs, filtre)
    const visibles = blocs.filter((bloc) => correspond(filtre, bloc.statut))
    compteur = texteBlocs(visibles.length)
    if (module !== null) {
      entete = (
        <>
          <h1 tabIndex={-1} className={`${catalogue['titre'] ?? ''} texte-titre-28`}>
            {titreModule(module.module.ordre)}
          </h1>
          {module.module.description !== '' && (
            <p className={`${catalogue['intro'] ?? ''} texte-corps-16`}>
              {module.module.description}
            </p>
          )}
        </>
      )
      filAriane = module.formation.id
    }
    if (blocs.length === 0) {
      contenu = <EtatVideZone message={TEXTES_BLOCS.aucunBloc} />
    } else if (groupes.length === 0) {
      contenu = <EtatVideZone message={TEXTES_BLOCS.aucunBlocFiltre} />
    } else {
      contenu = (
        <div className={styles['colonnes']}>
          <div className={styles['parties']}>
            {groupes.map(({ partie, plage, blocs: dansLaPartie }) => (
              <section key={partie} className={styles['partie']}>
                <h2 className={`${styles['intertitre'] ?? ''} texte-legende-12`}>
                  {partie} ({plage})
                </h2>
                <ul className={styles['liste']}>
                  {dansLaPartie.map((bloc) => (
                    <LigneBloc
                      key={bloc.bloc}
                      bloc={bloc}
                      moduleId={moduleId}
                      selectionne={bloc.bloc === detail}
                      statutFiltre={filtre}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {detail !== undefined &&
            blocs.some(({ bloc }) => bloc === detail) &&
            (bureau ? (
              <PanneauDetail bloc={detail} contexte={etat.contexte} />
            ) : (
              <Dialogue
                titre={TEXTES_BLOCS.detail}
                libelleFermer={TEXTES_BLOCS.fermerDetail}
                surFermeture={() => {
                  void navigate({
                    to: '.',
                    search: (precedent) => ({
                      ...(precedent.statut === undefined ? {} : { statut: precedent.statut }),
                    }),
                  })
                }}
              >
                <PanneauDetail bloc={detail} contexte={etat.contexte} dansDialogue />
              </Dialogue>
            ))}
        </div>
      )
    }
  }

  const blocs = etat.phase === 'pret' ? etat.blocs : []
  return (
    <div className={catalogue['page']}>
      {etat.phase === 'pret' && etat.module !== null && filAriane !== null && (
        <>
          <nav aria-label={TEXTES_BLOCS.filAriane} className={catalogue['filAriane']}>
            <Link to="/formations" className={`${catalogue['lienDiscret'] ?? ''} texte-petit-14`}>
              Formations
            </Link>
            <span aria-hidden="true" className="texte-petit-14">
              /
            </span>
            <Link
              to="/formations/$formationId"
              params={{ formationId: filAriane }}
              className={`${catalogue['lienDiscret'] ?? ''} texte-petit-14`}
            >
              {filAriane}
            </Link>
            <span aria-hidden="true" className="texte-petit-14">
              /
            </span>
            <span aria-current="page" className="texte-petit-14">
              {titreModule(etat.module.module.ordre)}
            </span>
          </nav>
        </>
      )}
      <header className={catalogue['entete']}>
        {entete}
        {etat.phase === 'pret' && blocs.length > 0 && (
          <RepartitionStatuts statuts={blocs.map(({ statut }) => statut)} fine />
        )}
      </header>
      <div className={styles['outils']}>
        <GroupeSegmente<FiltreBlocs>
          libelle={TEXTES_BLOCS.filtre}
          valeur={filtre}
          options={[
            { valeur: 'tous', libelle: TEXTES_BLOCS.tous },
            { valeur: 'a_faire', libelle: TEXTES_BLOCS.aFaire },
            { valeur: 'a_reprendre', libelle: TEXTES_BLOCS.aReprendre },
          ]}
          onChange={(valeur) => {
            void navigate({
              to: '.',
              search: (precedent) => ({
                ...(precedent.detail === undefined ? {} : { detail: precedent.detail }),
                ...(valeur === 'tous' ? {} : { statut: valeur }),
              }),
            })
          }}
          className={styles['filtre'] ?? ''}
        />
        {compteur !== null && (
          <p className={`${styles['compteur'] ?? ''} texte-petit-14`} role="status">
            {compteur}
          </p>
        )}
      </div>
      {contenu}
    </div>
  )
}
