import type { EtatDemo, InterrupteursDemo } from '@janus/contrats'
import type { HorlogeDemo } from './horlogeDemo.ts'
import { etatVide } from './store.ts'
import type { Magasin } from './store.ts'

export type ModeReinitialisation = 'graine' | 'vide'

/** Ce que le build de démo expose aux tests Playwright, avant que les boutons de PR-072 existent. */
export interface OutilsDemo {
  /** Avance l'horloge de démo de `ms` millisecondes. */
  readonly avancer: (ms: number) => void
  /** Repart de la graine (les statuts du jeu d'exemple) ou d'un état vide. */
  readonly reinitialiser: (mode: ModeReinitialisation) => void
  /** Allume ou éteint un interrupteur de démo, sans recharger la page. */
  readonly interrupteur: (nom: keyof InterrupteursDemo, actif: boolean) => void
  /** L'heure de démo et les interrupteurs allumés, pour que le panneau de démo les affiche. */
  readonly lire: () => { readonly maintenant: string; readonly interrupteurs: InterrupteursDemo }
}

declare global {
  interface Window {
    __janusDemo?: OutilsDemo
  }
}

export interface OptionsOutilsDemo {
  readonly magasin: Magasin
  readonly horloge: HorlogeDemo
  /** Construit l'état de la graine à l'instant donné. */
  readonly graine?: (maintenant: string) => EtatDemo
  /** Appelé après chaque changement, pour que l'appli recharge ses données. */
  readonly apres?: (() => void) | undefined
}

export function creerOutilsDemo(options: OptionsOutilsDemo): OutilsDemo {
  const { magasin, horloge, graine = etatVide, apres } = options
  return {
    avancer: (ms) => {
      horloge.avancer(ms)
      apres?.()
    },
    interrupteur: (nom, actif) => {
      magasin.ecrire((etat) => ({
        ...etat,
        interrupteurs: { ...etat.interrupteurs, [nom]: actif },
      }))
      apres?.()
    },
    lire: () => ({ maintenant: horloge.maintenant(), interrupteurs: magasin.lire().interrupteurs }),
    reinitialiser: (mode) => {
      // La graine est datée par rapport à l'heure réelle : le décalage repart de zéro.
      const maintenant = horloge.reel()
      magasin.reinitialiser(mode === 'graine' ? graine(maintenant) : etatVide(maintenant))
      apres?.()
    },
  }
}
