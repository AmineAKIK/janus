import type { ReactNode } from 'react'
import { classes } from '../../utilitaires/classes.ts'
import styles from './CarteTacheDuJour.module.css'

export type TypeTacheDuJour = 'revision' | 'restitution' | 'preuve'

export const LIBELLES_TACHE: Record<TypeTacheDuJour, string> = {
  revision: 'Révision',
  restitution: 'Restitution',
  preuve: 'Preuve',
}

export interface ProprietesCarteTacheDuJour {
  readonly type: TypeTacheDuJour
  readonly titre: string
  readonly description?: string
  /** Le bouton de l'action, fourni par l'écran. */
  readonly action: ReactNode
  readonly className?: string
}

export function CarteTacheDuJour({
  type,
  titre,
  description,
  action,
  className,
}: ProprietesCarteTacheDuJour) {
  return (
    <article className={classes(styles['carte'], className)}>
      <div className={styles['contenu']}>
        <p className={classes(styles['type'], 'texte-legende-12')}>{LIBELLES_TACHE[type]}</p>
        <h3 className={classes(styles['titre'], 'texte-sous-titre-18')}>{titre}</h3>
        {description !== undefined && (
          <p className={classes(styles['description'], 'texte-petit-14')}>{description}</p>
        )}
      </div>
      <div className={styles['action']}>{action}</div>
    </article>
  )
}
