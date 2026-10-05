import type { Statut } from '@janus/contrats'
import { ArrowRight, ArrowRightLeft } from 'lucide-react'
import { classes } from '../../utilitaires/classes.ts'
import { BadgeStatut } from '../BadgeStatut/BadgeStatut.tsx'
import styles from './ChangementStatut.module.css'

export interface ProprietesChangementStatut {
  /** Heure déjà formatée. */
  readonly heure: string
  /** Code et titre du bloc concerné. */
  readonly bloc: string
  readonly avant: Statut
  readonly apres: Statut
  /** Pourquoi le statut a changé, par exemple pour un statut forcé. */
  readonly raison?: string
  readonly className?: string
}

export function ChangementStatut({
  heure,
  bloc,
  avant,
  apres,
  raison,
  className,
}: ProprietesChangementStatut) {
  return (
    <div className={classes(styles['ligne'], className)}>
      <ArrowRightLeft className={styles['icone']} aria-hidden="true" />
      <span className={classes(styles['heure'], 'texte-legende-12')}>{heure}</span>
      <span className={classes(styles['bloc'], 'texte-petit-14')}>{bloc}</span>
      <span className={styles['statuts']}>
        <BadgeStatut statut={avant} />
        <ArrowRight className={styles['fleche']} aria-hidden="true" />
        <span className={styles['cache']}>devient</span>
        <BadgeStatut statut={apres} />
      </span>
      {raison !== undefined && (
        <span className={classes(styles['raison'], 'texte-legende-12')}>{raison}</span>
      )}
    </div>
  )
}
