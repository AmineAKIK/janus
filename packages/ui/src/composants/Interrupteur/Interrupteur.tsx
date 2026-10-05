import type { ComponentProps } from 'react'
import { useContext } from 'react'
import { classes } from '../../utilitaires/classes.ts'
import { ContexteLigne } from '../LigneReglage/contexte.ts'
import styles from './Interrupteur.module.css'

export interface ProprietesInterrupteur extends Omit<
  ComponentProps<'button'>,
  'type' | 'role' | 'onChange' | 'children'
> {
  readonly coche: boolean
  readonly onChange: (coche: boolean) => void
}

/** Sans `aria-label` ni `aria-labelledby`, il se nomme d'après la `LigneReglage` qui le contient. */
export function Interrupteur({
  coche,
  onChange,
  className,
  disabled,
  ...proprietes
}: ProprietesInterrupteur) {
  const ligne = useContext(ContexteLigne)
  const nommeParLigne =
    proprietes['aria-label'] === undefined && proprietes['aria-labelledby'] === undefined
  return (
    <button
      {...proprietes}
      {...(nommeParLigne && ligne !== null ? { 'aria-labelledby': ligne.idLibelle } : {})}
      {...(ligne?.idAide !== undefined && proprietes['aria-describedby'] === undefined
        ? { 'aria-describedby': ligne.idAide }
        : {})}
      type="button"
      role="switch"
      aria-checked={coche}
      disabled={disabled}
      onClick={(evenement) => {
        proprietes.onClick?.(evenement)
        if (!evenement.defaultPrevented) onChange(!coche)
      }}
      className={classes(styles['interrupteur'], coche && styles['coche'], className)}
    >
      <span className={styles['pouce']} aria-hidden="true" />
    </button>
  )
}
