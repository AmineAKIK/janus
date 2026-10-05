import { ROUTES } from '@janus/contrats'
import { BadgeStatut, EtatVideZone } from '@janus/ui'
import { Link } from '@tanstack/react-router'
import { useLecture } from '../api/requetes.tsx'
import { compter, statutGlobal } from './calculs.ts'
import styles from './Catalogue.module.css'
import { Chargement, Erreur } from './EtatEcran.tsx'
import { LegendeStatuts, RepartitionStatuts } from './RepartitionStatuts.tsx'
import { TEXTES, texteAcquis, texteResume } from './textes.ts'
import { useFormation } from './useFormation.ts'

function CarteFormation({ id, titre }: { readonly id: string; readonly titre: string }) {
  const formation = useFormation(id)
  if (formation.phase === 'chargement') return <div className={styles['squelette']} />
  if (formation.phase === 'erreur') return <Erreur reessayer={formation.reessayer} />

  const { modules } = formation
  const statuts = modules.flatMap((module) => module.statuts)
  const { acquis, total } = compter(statuts)
  const importes = modules.filter((module) => module.importe)
  const enCours = importes.find((module) => compter(module.statuts).ouverts > 0) ?? importes[0]
  const commencee = importes.length > 0

  return (
    <article
      className={`${styles['carte'] ?? ''} ${commencee ? '' : (styles['carteDouce'] ?? '')}`}
    >
      <div className={styles['resume']}>
        <div className={styles['identite']}>
          <h2 className={`${styles['titreCarte'] ?? ''} texte-titre-22`}>
            <Link
              to="/formations/$formationId"
              params={{ formationId: id }}
              className={styles['lien']}
            >
              {id} · {titre}
            </Link>
          </h2>
          <p className={`${styles['meta'] ?? ''} texte-petit-14`}>
            {texteResume(modules.length, enCours === undefined ? null : enCours.statuts.length)}
          </p>
        </div>
        <BadgeStatut statut={statutGlobal(statuts)} taille="compacte" />
      </div>
      <RepartitionStatuts statuts={commencee ? statuts : []} />
      {commencee ? (
        <>
          <p className="texte-corps-16">{texteAcquis(acquis, total)}</p>
          <LegendeStatuts titre={TEXTES.legende} />
        </>
      ) : (
        <p className={`${styles['meta'] ?? ''} texte-petit-14`}>{TEXTES.formationNonCommencee}</p>
      )}
    </article>
  )
}

export function PageFormations() {
  const formations = useLecture(ROUTES['GET /formations'], {})

  let contenu
  if (formations.isError) {
    contenu = <Erreur reessayer={() => void formations.refetch()} />
  } else if (formations.data === undefined) {
    contenu = <Chargement />
  } else if (formations.data.formations.length === 0) {
    contenu = <EtatVideZone message={TEXTES.aucuneFormation} />
  } else {
    contenu = (
      <div className={styles['liste']}>
        {formations.data.formations.map(({ id, titre }) => (
          <CarteFormation key={id} id={id} titre={titre} />
        ))}
      </div>
    )
  }

  return (
    <div className={styles['page']}>
      <header className={styles['entete']}>
        <h1 tabIndex={-1} className={`${styles['titre'] ?? ''} texte-titre-28`}>
          {TEXTES.titreFormations}
        </h1>
        <p className={`${styles['intro'] ?? ''} texte-corps-16`}>{TEXTES.introFormations}</p>
      </header>
      {contenu}
    </div>
  )
}
