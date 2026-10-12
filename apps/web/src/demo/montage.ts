import type { Transport } from '@janus/contrats'
import { creerHorlogeDemo } from './horlogeDemo.ts'
import { creerOutilsDemo } from './outils.ts'
import { etatGraine } from './graine.ts'
import { creerRoutesDemo } from './routes/index.ts'
import { creerMagasin } from './store.ts'
import { creerTransportDemo } from './transportDemo.ts'
import { instantReel } from '../horloge.ts'

export interface OptionsMontage {
  /** Appelé quand la démo change d'un coup (horloge, réinitialisation) : l'appli recharge ses données. */
  readonly apresChangementDemo?: (() => void) | undefined
}

/** `localStorage`, ou `null` quand le navigateur le refuse (navigation privée, iframe sandbox). */
function stockageDisponible(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** L'adresse absolue du dossier des fiches, qui suit `base` de Vite (GitHub Pages sert sous /janus/). */
function racineFiches(): string {
  return new URL(`${import.meta.env.BASE_URL}fiches/`, window.location.href).href
}

/** Monte le backend de démo (magasin, horloge, outils, routes). Chargé à la demande : le build `http` ne l'embarque pas. */
export function monterLaDemo(options: OptionsMontage = {}): Transport {
  const magasin = creerMagasin({
    stockage: stockageDisponible(),
    creerEtat: () => etatGraine(instantReel()),
  })
  const horloge = creerHorlogeDemo({
    decalage: {
      lire: () => magasin.lire().decalageMs,
      ecrire: (ms) => {
        magasin.ecrire((etat) => ({ ...etat, decalageMs: ms }))
      },
    },
  })
  window.__janusDemo = creerOutilsDemo({
    magasin,
    horloge,
    graine: etatGraine,
    apres: options.apresChangementDemo,
  })
  return creerTransportDemo({
    magasin,
    horloge,
    routes: creerRoutesDemo({ racineFiches: racineFiches() }),
  })
}
