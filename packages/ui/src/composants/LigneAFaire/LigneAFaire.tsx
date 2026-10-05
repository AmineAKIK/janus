import { classes } from '../../utilitaires/classes.ts'
import type { RendreLien } from '../../utilitaires/lien.ts'
import styles from './LigneAFaire.module.css'

export interface ProprietesLigneAFaire {
  /** Libellé du type de tâche, par exemple « Vérification ». */
  readonly type: string
  /** Code et titre du bloc concerné. */
  readonly bloc: string
  /** Échéance déjà formatée. */
  readonly echeance: string
  readonly prioritaire?: boolean
  /** Le lien qui démarre la tâche : il porte le nom accessible complet. */
  readonly lien: RendreLien
  readonly className?: string
}

export function LigneAFaire({
  type,
  bloc,
  echeance,
  prioritaire = false,
  lien,
  className,
}: ProprietesLigneAFaire) {
  return (
    <div className={classes(styles['ligne'], prioritaire && styles['prioritaire'], className)}>
      <div className={styles['contenu']}>
        <p className={classes(styles['type'], 'texte-legende-12')}>{type}</p>
        <p className={classes(styles['bloc'], 'texte-petit-14')}>
          {bloc}
          {prioritaire && <span className={styles['cache']}>, prioritaire</span>}
        </p>
      </div>
      <p className={classes(styles['echeance'], 'texte-legende-12')}>{echeance}</p>
      {lien({
        className: classes(styles['action'], 'texte-corps-16'),
        children: (
          <>
            Commencer
            <span className={styles['cache']}>{` ${type}, ${bloc}`}</span>
          </>
        ),
      })}
    </div>
  )
}
