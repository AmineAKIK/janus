import type { Statut } from '@janus/contrats'
import { ArrowLeft, BadgeStatut } from '@janus/ui'
import { Link } from '@tanstack/react-router'
import styles from './Bloc.module.css'
import { TEXTES_BLOC } from './textes.ts'

/** La barre du haut : retour aux blocs, code, titre, statut calculé et état d'enregistrement. */
export function BarreBloc({
  code,
  titre,
  moduleId,
  statut,
}: {
  readonly code: string
  readonly titre: string
  readonly moduleId: string
  readonly statut: Statut
}) {
  return (
    <div className={styles['barre']}>
      <Link
        to="/modules/$moduleId"
        params={{ moduleId }}
        search={{ detail: code }}
        aria-label={TEXTES_BLOC.retour}
        className={styles['retour']}
      >
        <ArrowLeft aria-hidden="true" className={styles['fleche']} />
      </Link>
      <span className={`${styles['code'] ?? ''} texte-code-14`}>{code}</span>
      <h1 tabIndex={-1} className={`${styles['titre'] ?? ''} texte-corps-16`}>
        {titre}
      </h1>
      <BadgeStatut statut={statut} className={styles['statut'] ?? ''} />
      <span className={`${styles['enregistre'] ?? ''} texte-legende-12`}>
        {TEXTES_BLOC.enregistre}
      </span>
    </div>
  )
}
