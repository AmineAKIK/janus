import { LIBELLE_MODULE_NON_IMPORTE, ROUTES } from '@janus/contrats'
import { ArrowLeft, BadgeStatut, ChevronRight, EtatVideZone } from '@janus/ui'
import { Link } from '@tanstack/react-router'
import { useLecture } from '../api/requetes.tsx'
import { compter, statutGlobal } from './calculs.ts'
import styles from './Catalogue.module.css'
import { Chargement, Erreur } from './EtatEcran.tsx'
import { RepartitionStatuts } from './RepartitionStatuts.tsx'
import { TEXTES, texteCompteursModule, texteModule } from './textes.ts'
import { useFormation } from './useFormation.ts'
import type { ModuleChiffre } from './useFormation.ts'

function LigneModule({ module }: { readonly module: ModuleChiffre }) {
  const titre = texteModule(module.ordre, module.titre)
  if (!module.importe) {
    return (
      <li className={`${styles['module'] ?? ''} ${styles['moduleIndisponible'] ?? ''}`}>
        <BadgeStatut statut="non_commence" taille="compacte" />
        <div className={styles['libelles']}>
          <p className="texte-petit-14">{titre}</p>
          <p className={`${styles['meta'] ?? ''} texte-legende-12`}>{LIBELLE_MODULE_NON_IMPORTE}</p>
        </div>
      </li>
    )
  }
  const { total, ouverts, acquis } = compter(module.statuts)
  return (
    <li>
      <Link
        to="/modules/$moduleId"
        params={{ moduleId: module.id }}
        className={`${styles['module'] ?? ''} ${styles['moduleDisponible'] ?? ''}`}
      >
        <div className={styles['ligneModule']}>
          <BadgeStatut statut={statutGlobal(module.statuts)} taille="compacte" />
          <div className={styles['libelles']}>
            <p className="texte-sous-titre-18">{titre}</p>
            <p className={`${styles['meta'] ?? ''} texte-petit-14`}>
              {texteCompteursModule(total, ouverts, acquis)}
            </p>
          </div>
          <ChevronRight aria-hidden="true" className={styles['chevron']} />
        </div>
        <RepartitionStatuts statuts={module.statuts} fine />
      </Link>
    </li>
  )
}

export function PageModules({ formationId }: { readonly formationId: string }) {
  const formations = useLecture(ROUTES['GET /formations'], {})
  const formation = useFormation(formationId)
  const connue = formations.data?.formations.find(({ id }) => id === formationId)

  let contenu
  if (formation.phase === 'erreur') {
    contenu = <Erreur reessayer={formation.reessayer} />
  } else if (formation.phase === 'chargement') {
    contenu = <Chargement nombre={3} />
  } else if (formation.modules.length === 0) {
    contenu = <EtatVideZone message={TEXTES.aucunModule} />
  } else {
    contenu = (
      <ul className={styles['liste']}>
        {formation.modules.map((module) => (
          <LigneModule key={module.id} module={module} />
        ))}
      </ul>
    )
  }

  return (
    <div className={styles['page']}>
      <nav aria-label="Fil d’Ariane" className={styles['filAriane']}>
        <Link to="/formations" className={`${styles['lienDiscret'] ?? ''} texte-petit-14`}>
          {TEXTES.retourFormations}
        </Link>
        <span aria-hidden="true" className="texte-petit-14">
          /
        </span>
        <span aria-current="page" className="texte-petit-14">
          {formationId}
        </span>
      </nav>
      <Link
        to="/formations"
        className={`${styles['retour'] ?? ''} ${styles['lienDiscret'] ?? ''} texte-petit-14`}
      >
        <ArrowLeft aria-hidden="true" className={styles['chevron']} />
        {TEXTES.retourFormations}
      </Link>
      <header className={styles['entete']}>
        <h1 tabIndex={-1} className={`${styles['titre'] ?? ''} texte-titre-28`}>
          {connue === undefined ? formationId : `${formationId} · ${connue.titre}`}
        </h1>
        {connue !== undefined && connue.description !== '' && (
          <p className={`${styles['intro'] ?? ''} texte-corps-16`}>{connue.description}</p>
        )}
      </header>
      {contenu}
    </div>
  )
}
