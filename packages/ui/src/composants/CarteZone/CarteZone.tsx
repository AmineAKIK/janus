import type { ReactNode } from 'react'
import { useId } from 'react'
import { classes } from '../../utilitaires/classes.ts'
import styles from './CarteZone.module.css'

export interface ProprietesCarteZone {
  readonly titre: string
  /** Lien facultatif, par exemple « Voir tout » : fourni par l'écran. */
  readonly action?: ReactNode
  readonly children: ReactNode
  readonly className?: string
}

export function CarteZone({ titre, action, children, className }: ProprietesCarteZone) {
  const idTitre = useId()
  return (
    <section aria-labelledby={idTitre} className={classes(styles['carte'], className)}>
      <div className={styles['entete']}>
        <h2 id={idTitre} className={classes(styles['titre'], 'texte-sous-titre-18')}>
          {titre}
        </h2>
        {action !== undefined && (
          <div className={classes(styles['action'], 'texte-petit-14')}>{action}</div>
        )}
      </div>
      <div className={classes(styles['contenu'], 'texte-petit-14')}>{children}</div>
    </section>
  )
}
