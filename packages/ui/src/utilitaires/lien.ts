import type { ReactNode } from 'react'

/** Ce que reçoit la fonction `lien` des composants : à poser tel quel sur le lien du routeur. */
export interface ProprietesLien {
  readonly className: string
  readonly children: ReactNode
}

/** Rend un lien du routeur, pour que `ui` ne dépende pas du routeur. */
export type RendreLien = (proprietes: ProprietesLien) => ReactNode
