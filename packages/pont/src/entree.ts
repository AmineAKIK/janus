import { suivreLAtelier, suivreLaPratique } from '@janus/contrats/pratique'
import { creerPont } from './pont.ts'
import type { Pont } from './pont.ts'

/** Les règles de la pratique et de l'atelier, les mêmes que celles du moteur : la page en relit l'état. */
export interface JanusPratique {
  readonly suivre: typeof suivreLaPratique
  readonly atelier: typeof suivreLAtelier
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
window.JanusPratique = { suivre: suivreLaPratique, atelier: suivreLAtelier }
