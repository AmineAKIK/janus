import { Check } from 'lucide-react'
import type { ComponentProps } from 'react'
import { classes } from '../../utilitaires/classes.ts'
import styles from './CaseACocher.module.css'

export interface ProprietesCaseACocher extends Omit<ComponentProps<'input'>, 'type' | 'children'> {
  readonly libelle: string
}

export function CaseACocher({ libelle, className, ...proprietes }: ProprietesCaseACocher) {
  return (
    <label className={classes(styles['case'], 'texte-petit-14', className)}>
      <input {...proprietes} type="checkbox" className={styles['entree']} />
      <span className={styles['boite']} aria-hidden="true">
        <Check className={styles['coche']} />
      </span>
      <span>{libelle}</span>
    </label>
  )
}
