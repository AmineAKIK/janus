import { Lock } from 'lucide-react'
import { classes } from '../../utilitaires/classes.ts'
import styles from './LigneLectureSeule.module.css'

export interface ProprietesLigneLectureSeule {
  readonly libelle: string
  readonly valeur: string
  readonly className?: string
}

export function LigneLectureSeule({ libelle, valeur, className }: ProprietesLigneLectureSeule) {
  return (
    <dl className={classes(styles['ligne'], className)}>
      <Lock className={styles['cadenas']} aria-hidden={true} />
      <div className={styles['textes']}>
        <dt className={classes(styles['libelle'], 'texte-petit-14')}>{libelle}</dt>
        <dd className={classes(styles['valeur'], 'texte-legende-12')}>{valeur}</dd>
      </div>
    </dl>
  )
}
