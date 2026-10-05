import { creerPont } from './pont.ts'
import type { Pont } from './pont.ts'

declare global {
  interface Window {
    /** L'API que chaque fiche utilise pour parler à l'appli. */
    JanusPont?: Pont
  }
}

window.JanusPont = creerPont()
