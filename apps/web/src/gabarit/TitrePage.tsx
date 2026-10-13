import type { ReactNode } from 'react'
import styles from './TitrePage.module.css'

/**
 * Le `h1` d'un écran. Le gabarit lui donne le focus à chaque changement de route (`tabIndex`
 * -1) : il n'a donc ni marge ni anneau de focus. `className` ajoute la mise en page de l'écran.
 */
export function TitrePage({
  children,
  taille = 'texte-titre-28',
  className,
}: {
  readonly children: ReactNode
  /** La classe typographique de `packages/ui` ; le grand titre par défaut. */
  readonly taille?: 'texte-titre-28' | 'texte-sous-titre-18' | 'texte-corps-16'
  readonly className?: string | undefined
}) {
  return (
    <h1 tabIndex={-1} className={`${styles['titre'] ?? ''} ${className ?? ''} ${taille}`}>
      {children}
    </h1>
  )
}
