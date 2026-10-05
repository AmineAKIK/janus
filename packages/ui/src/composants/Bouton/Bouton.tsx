import { LoaderCircle } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { classes } from '../../utilitaires/classes.ts'
import styles from './Bouton.module.css'

export type VarianteBouton = 'principal' | 'secondaire' | 'texte'

export interface ProprietesBouton extends ComponentProps<'button'> {
  readonly variante?: VarianteBouton
  /** Affiche un indicateur à la place de l'icône et désactive le bouton. */
  readonly chargement?: boolean
  readonly pleineLargeur?: boolean
  /** Icône avant le libellé. */
  readonly icone?: ReactNode
}

export function Bouton({
  variante = 'principal',
  chargement = false,
  pleineLargeur = false,
  icone,
  type = 'button',
  disabled,
  className,
  children,
  ...proprietes
}: ProprietesBouton) {
  return (
    <button
      {...proprietes}
      type={type}
      disabled={disabled === true || chargement}
      aria-busy={chargement ? 'true' : undefined}
      className={classes(
        styles['bouton'],
        styles[variante],
        pleineLargeur && styles['pleineLargeur'],
        'texte-corps-16',
        className,
      )}
    >
      {chargement ? (
        <LoaderCircle className={styles['indicateur']} aria-hidden="true" />
      ) : (
        icone !== undefined && <span className={styles['icone']}>{icone}</span>
      )}
      <span className={styles['libelle']}>{children}</span>
    </button>
  )
}
