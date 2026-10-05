import { useId } from 'react'
import { classes } from '../../utilitaires/classes.ts'
import styles from './GroupeSegmente.module.css'

export interface OptionSegmentee<V extends string> {
  readonly valeur: V
  readonly libelle: string
}

export interface ProprietesGroupeSegmente<V extends string> {
  /** Nom accessible du groupe. */
  readonly libelle: string
  readonly options: readonly OptionSegmentee<V>[]
  /** `null` : aucun choix fait. */
  readonly valeur: V | null
  readonly onChange: (valeur: V) => void
  /** Le parent empêche l'envoi tant que `valeur` vaut `null`. */
  readonly obligatoire?: boolean
  readonly className?: string
}

/** Groupe de boutons radio natifs présentés en segments ; les flèches changent de choix. */
export function GroupeSegmente<V extends string>({
  libelle,
  options,
  valeur,
  onChange,
  obligatoire = false,
  className,
}: ProprietesGroupeSegmente<V>) {
  const nom = useId()
  return (
    <div
      role="radiogroup"
      aria-label={libelle}
      aria-required={obligatoire ? true : undefined}
      className={classes(styles['groupe'], className)}
    >
      {options.map((option) => (
        <label key={option.valeur} className={classes(styles['option'], 'texte-petit-14')}>
          <input
            type="radio"
            name={nom}
            value={option.valeur}
            checked={option.valeur === valeur}
            required={obligatoire}
            onChange={() => {
              onChange(option.valeur)
            }}
            className={styles['entree']}
          />
          <span className={styles['texte']}>{option.libelle}</span>
        </label>
      ))}
    </div>
  )
}
