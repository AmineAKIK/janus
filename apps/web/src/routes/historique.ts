import { createBrowserHistory, createHashHistory } from '@tanstack/react-router'
import type { RouterHistory } from '@tanstack/react-router'

export type ModeHistorique = 'ancre' | 'chemins'

/** `chemins` seulement s'il est demandé : GitHub Pages ne sait pas servir de vraies adresses. */
export function modeHistorique(valeur: string | undefined): ModeHistorique {
  return valeur === 'chemins' ? 'chemins' : 'ancre'
}

export function creerHistorique(mode: ModeHistorique): RouterHistory {
  return mode === 'chemins' ? createBrowserHistory() : createHashHistory()
}
