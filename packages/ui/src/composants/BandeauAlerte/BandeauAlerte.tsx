import { CircleAlert, CircleCheck, CircleX, TriangleAlert } from 'lucide-react'
import type { ComponentProps } from 'react'
import { classes } from '../../utilitaires/classes.ts'
import styles from './BandeauAlerte.module.css'

export type TypeBandeau = 'erreur' | 'info' | 'succes' | 'avertissement'

export interface ProprietesBandeauAlerte extends Omit<ComponentProps<'div'>, 'role'> {
  readonly type: TypeBandeau
}

const ICONES = {
  erreur: CircleX,
  info: CircleAlert,
  succes: CircleCheck,
  avertissement: TriangleAlert,
} as const

export function BandeauAlerte({
  type,
  className,
  children,
  ...proprietes
}: ProprietesBandeauAlerte) {
  const Icone = ICONES[type]

  return (
    <div
      {...proprietes}
      role={type === 'erreur' ? 'alert' : 'status'}
      className={classes(styles['bandeau'], styles[type], 'texte-petit-14', className)}
    >
      <Icone className={styles['icone']} aria-hidden="true" />
      <div className={styles['contenu']}>{children}</div>
    </div>
  )
}
