import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { useId, useState } from 'react'
import { classes } from '../../utilitaires/classes.ts'
import styles from './LigneEvenement.module.css'

export interface ProprietesLigneEvenement {
  /** Heure déjà formatée. */
  readonly heure: string
  readonly titre: string
  /** Lignes secondaires sous le titre. */
  readonly precisions?: readonly string[]
  /** Badges de la ligne, par exemple `BadgeNeComptePas`. */
  readonly badges?: ReactNode
  /** Contenu visible quand la ligne est dépliée. Sans lui, la ligne n'est pas depliable. */
  readonly detail?: ReactNode
  readonly deplieParDefaut?: boolean
  readonly className?: string
}

export function LigneEvenement({
  heure,
  titre,
  precisions = [],
  badges,
  detail,
  deplieParDefaut = false,
  className,
}: ProprietesLigneEvenement) {
  const idDetail = useId()
  const [deplie, setDeplie] = useState(deplieParDefaut)
  const depliable = detail !== undefined

  const contenu = (
    <>
      <span className={classes(styles['heure'], 'texte-legende-12')}>{heure}</span>
      <span className={styles['textes']}>
        <span className={classes(styles['titre'], 'texte-petit-14')}>{titre}</span>
        {precisions.map((precision) => (
          <span key={precision} className={classes(styles['precision'], 'texte-legende-12')}>
            {precision}
          </span>
        ))}
      </span>
    </>
  )

  return (
    <div className={classes(styles['ligne'], className)}>
      {depliable ? (
        <button
          type="button"
          className={styles['entete']}
          aria-expanded={deplie}
          aria-controls={idDetail}
          onClick={() => {
            setDeplie((courant) => !courant)
          }}
        >
          {contenu}
          <ChevronRight
            className={classes(styles['chevron'], deplie && styles['chevronDeplie'])}
            aria-hidden="true"
          />
        </button>
      ) : (
        <div className={styles['entete']}>{contenu}</div>
      )}
      {badges !== undefined && <div className={styles['badges']}>{badges}</div>}
      {depliable && (
        <div id={idDetail} className={classes(styles['detail'], 'texte-petit-14')} hidden={!deplie}>
          {detail}
        </div>
      )}
    </div>
  )
}
