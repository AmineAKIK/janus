import type { RaisonNonCompte } from '@janus/contrats'
import { classes } from '../../utilitaires/classes.ts'
import styles from './BadgeNeComptePas.module.css'

export const LIBELLES_RAISON: Record<RaisonNonCompte, string> = {
  relance: 'Relance',
  avec_support: 'Avec support',
  recopiee: 'Recopiée',
  non_verifiee: 'Non vérifiée',
}

export interface ProprietesBadgeNeComptePas {
  readonly raison: RaisonNonCompte
  readonly className?: string
}

export function BadgeNeComptePas({ raison, className }: ProprietesBadgeNeComptePas) {
  return (
    <span className={classes(styles['badge'], 'texte-legende-12', className)}>
      {`Ne compte pas · ${LIBELLES_RAISON[raison]}`}
    </span>
  )
}
