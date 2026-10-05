import { createContext } from 'react'

/** Identifiants du libellé et de l'aide d'une ligne, pour nommer le contrôle qu'elle contient. */
export interface ContexteLigneReglage {
  readonly idLibelle: string
  readonly idAide: string | undefined
}

export const ContexteLigne = createContext<ContexteLigneReglage | null>(null)
