import { suivreLaPratique } from '@janus/contrats/pratique'
import { creerPont } from './pont.ts'
import type { Pont } from './pont.ts'

/** La règle de la pratique, la même que celle du moteur : la page en relit ses items. */
export interface JanusPratique {
  readonly suivre: typeof suivreLaPratique
}

declare global {
  interface Window {
    /** L'API que chaque fiche utilise pour parler à l'appli. */
    JanusPont?: Pont
    /** Les règles que la fiche partage avec le moteur. */
    JanusPratique?: JanusPratique
  }
}

window.JanusPont = creerPont()
window.JanusPratique = { suivre: suivreLaPratique }
