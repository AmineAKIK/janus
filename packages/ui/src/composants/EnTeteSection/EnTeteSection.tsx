import { classes } from '../../utilitaires/classes.ts'
import styles from './EnTeteSection.module.css'

export interface ProprietesEnTeteSection {
  readonly titre: string
  readonly description?: string
  readonly className?: string
}

export function EnTeteSection({ titre, description, className }: ProprietesEnTeteSection) {
  return (
    <header className={classes(styles['entete'], className)}>
      <h2 className={classes(styles['titre'], 'texte-sous-titre-18')}>{titre}</h2>
      {description !== undefined && (
        <p className={classes(styles['description'], 'texte-petit-14')}>{description}</p>
      )}
    </header>
  )
}
