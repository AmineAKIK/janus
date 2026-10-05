import { classes } from '../../utilitaires/classes.ts'
import styles from './EtatVideZone.module.css'

export interface ProprietesEtatVideZone {
  readonly message: string
  readonly className?: string
}

/** Ce qu'une zone affiche tant qu'elle n'a rien à montrer. */
export function EtatVideZone({ message, className }: ProprietesEtatVideZone) {
  return <p className={classes(styles['vide'], 'texte-petit-14', className)}>{message}</p>
}
