import type { Niveau, Source } from '@janus/contrats'
import type { ReactNode } from 'react'
import { classes } from '../../utilitaires/classes.ts'
import styles from './BulleCorrection.module.css'

export const LIBELLES_NIVEAU: Record<Niveau, string> = {
  solide: 'Solide',
  partiel: 'Partiel',
  fragile: 'Fragile',
  pas_encore: 'Pas encore',
}

export const LIBELLES_SOURCE: Record<Source, string> = {
  support: 'D’après le cours',
  deduit: 'Déduit du cours',
  ajoute: 'Ajouté hors du cours',
}

const CLASSES_NIVEAU: Record<Niveau, string> = {
  solide: 'solide',
  partiel: 'partiel',
  fragile: 'fragile',
  pas_encore: 'pasEncore',
}

export interface ProprietesBulleCorrection {
  readonly niveau: Niveau
  /** Texte simple : les retours à la ligne sont gardés, aucun HTML n'est interprété. */
  readonly message: string
  readonly source: Source
  /** Affiche le badge « À vérifier ». */
  readonly nonVerifie?: boolean
  /** Actions possibles, par exemple « Je ne suis pas d'accord » et « Relancer ». */
  readonly enfants?: ReactNode
  readonly className?: string
}

export function BulleCorrection({
  niveau,
  message,
  source,
  nonVerifie = false,
  enfants,
  className,
}: ProprietesBulleCorrection) {
  return (
    <article className={classes(styles['bulle'], styles[CLASSES_NIVEAU[niveau]], className)}>
      <p className={classes(styles['niveau'], 'texte-petit-14')}>
        <span className={styles['pastille']} aria-hidden="true" />
        {LIBELLES_NIVEAU[niveau]}
      </p>
      <p className={classes(styles['message'], 'texte-corps-16')}>{message}</p>
      <p className={classes(styles['pied'], 'texte-legende-12')}>
        <span className={styles['source']}>{LIBELLES_SOURCE[source]}</span>
        {nonVerifie && <span className={styles['aVerifier']}>À vérifier</span>}
      </p>
      {enfants !== undefined && <div className={styles['actions']}>{enfants}</div>}
    </article>
  )
}
