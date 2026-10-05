import type { ReactNode } from 'react'
import { useId } from 'react'
import { classes } from '../../utilitaires/classes.ts'
import { ContexteLigne } from './contexte.ts'
import styles from './LigneReglage.module.css'

export interface ProprietesLigneReglage {
  readonly libelle: string
  readonly aide?: string
  /** Interrupteur, champ ou bouton. Un `Interrupteur` y prend son nom du libellé de la ligne. */
  readonly controle: ReactNode
  readonly className?: string
}

export function LigneReglage({ libelle, aide, controle, className }: ProprietesLigneReglage) {
  const id = useId()
  const idLibelle = `${id}-libelle`
  const idAide = aide === undefined ? undefined : `${id}-aide`
  return (
    <div className={classes(styles['ligne'], className)}>
      <div className={styles['textes']}>
        <p id={idLibelle} className={classes(styles['libelle'], 'texte-petit-14')}>
          {libelle}
        </p>
        {aide !== undefined && (
          <p id={idAide} className={classes(styles['aide'], 'texte-legende-12')}>
            {aide}
          </p>
        )}
      </div>
      <div className={styles['controle']}>
        <ContexteLigne.Provider value={{ idLibelle, idAide }}>{controle}</ContexteLigne.Provider>
      </div>
    </div>
  )
}
