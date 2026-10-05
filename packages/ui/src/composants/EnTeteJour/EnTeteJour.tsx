import { classes } from '../../utilitaires/classes.ts'
import styles from './EnTeteJour.module.css'

export interface ProprietesEnTeteJour {
  /** Date déjà formatée. */
  readonly date: string
  /** Résumé du jour, déjà formaté. */
  readonly resume: string
  readonly className?: string
}

export function EnTeteJour({ date, resume, className }: ProprietesEnTeteJour) {
  return (
    <header className={classes(styles['entete'], className)}>
      <h3 className={classes(styles['date'], 'texte-sous-titre-18')}>{date}</h3>
      <p className={classes(styles['resume'], 'texte-legende-12')}>{resume}</p>
    </header>
  )
}
