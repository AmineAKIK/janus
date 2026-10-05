import type { Transport } from '@janus/contrats'
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

/** Le transport choisi par `VITE_TRANSPORT` : tout le reste de l'appli ne connaît que `Transport`. */
export function creerTransport(env: EnvironnementApi): Transport {
  if (modeTransport(env.VITE_TRANSPORT) === 'http') {
    return creerTransportHttp({ base: env.VITE_API ?? '/api' })
  }
  // Le backend de démo arrive avec PR-032 ; d'ici là, la démo répond par une erreur claire.
  return {
    appeler: () =>
      Promise.reject(new Error('Le backend de démo n’est pas encore branché (PR-032).')),
  }
}
