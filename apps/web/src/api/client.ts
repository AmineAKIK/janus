import type { Transport } from '@janus/contrats'
import { creerHorlogeDemo, instantReel } from '../demo/horlogeDemo.ts'
import { creerOutilsDemo } from '../demo/outils.ts'
import { creerMagasin, etatVide } from '../demo/store.ts'
import { creerTransportDemo } from '../demo/transportDemo.ts'
import { ROUTES_DEMO } from '../demo/routes/index.ts'
import { creerTransportHttp } from './transportHttp.ts'

export type ModeTransport = 'demo' | 'http'

/** `http` seulement s'il est demandé : GitHub Pages n'a pas de serveur, il parle au backend de démo. */
export function modeTransport(valeur: string | undefined): ModeTransport {
  return valeur === 'http' ? 'http' : 'demo'
}

export interface EnvironnementApi {
  readonly VITE_TRANSPORT?: string | undefined
  readonly VITE_API?: string | undefined
}

export interface OptionsTransport {
  /** Appelé quand la démo change d'un coup (horloge, réinitialisation) : l'appli recharge ses données. */
  readonly apresChangementDemo?: () => void
}

/** `localStorage`, ou `null` quand le navigateur le refuse (navigation privée, iframe sandbox). */
function stockageDisponible(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Le transport choisi par `VITE_TRANSPORT` : tout le reste de l'appli ne connaît que `Transport`. */
export function creerTransport(env: EnvironnementApi, options: OptionsTransport = {}): Transport {
  if (modeTransport(env.VITE_TRANSPORT) === 'http') {
    return creerTransportHttp({ base: env.VITE_API ?? '/api' })
  }
  const magasin = creerMagasin({
    stockage: stockageDisponible(),
    creerEtat: () => etatVide(instantReel()),
  })
  const horloge = creerHorlogeDemo({
    decalage: {
      lire: () => magasin.lire().decalageMs,
      ecrire: (ms) => {
        magasin.ecrire((etat) => ({ ...etat, decalageMs: ms }))
      },
    },
  })
  window.__janusDemo = creerOutilsDemo({ magasin, horloge, apres: options.apresChangementDemo })
  return creerTransportDemo({ magasin, horloge, routes: ROUTES_DEMO })
}
