import type { Transport } from '@janus/contrats'
import { prechargementsDeLaPage } from './prechargement.ts'
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

/**
 * Le backend de démo, chargé à la demande. Pour un build `http`, Vite remplace `VITE_TRANSPORT`
 * par sa valeur : la branche disparaît et la démo (graine, routes simulées, mot de passe) n'est
 * pas dans le paquet de production.
 */
const chargerLaDemo =
  import.meta.env.VITE_TRANSPORT === 'http' ? undefined : () => import('../demo/montage.ts')

/** Le transport choisi par `VITE_TRANSPORT` : tout le reste de l'appli ne connaît que `Transport`. */
export async function creerTransport(
  env: EnvironnementApi,
  options: OptionsTransport = {},
): Promise<Transport> {
  if (modeTransport(env.VITE_TRANSPORT) === 'http') {
    return creerTransportHttp({
      base: env.VITE_API ?? '/api',
      precharges: prechargementsDeLaPage(window),
    })
  }
  if (chargerLaDemo === undefined) {
    throw new Error('Ce build ne contient pas la démo : VITE_TRANSPORT vaut « http ».')
  }
  const { monterLaDemo } = await chargerLaDemo()
  return monterLaDemo(options)
}
