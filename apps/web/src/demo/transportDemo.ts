import { ErreurApi, ErreurReseau, nomRoute, validerEntree, validerSortie } from '@janus/contrats'
import type { DefinitionRoute, EntreeValidee, Transport } from '@janus/contrats'
import type { HorlogeDemo } from './horlogeDemo.ts'
import type { Magasin } from './store.ts'

/** Ce qu'une route de démo reçoit : l'entrée déjà validée, le store et l'horloge. */
export interface ContexteRoute {
  readonly magasin: Magasin
  readonly horloge: HorlogeDemo
  readonly entree: EntreeValidee
  readonly route: DefinitionRoute
}

/** Une route de démo : une fonction par route, comme dans l'API réelle. Sa réponse est validée ensuite. */
export type RouteDemo = (contexte: ContexteRoute) => unknown

/** Les routes de démo, par « MÉTHODE chemin ». */
export type RoutesDemo = Readonly<Record<string, RouteDemo>>

export interface OptionsTransportDemo {
  readonly magasin: Magasin
  readonly horloge: HorlogeDemo
  readonly routes: RoutesDemo
  /** Délai simulé avant chaque réponse, en millisecondes (0 par défaut). */
  readonly delaiMs?: number
}

/** Les seules routes qu'on peut appeler sans session. */
const SANS_SESSION: ReadonlySet<string> = new Set(['POST /session'])

function attendre(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resoudre, rejeter) => {
    const arreter = () => {
      clearTimeout(minuteur)
      rejeter(new DOMException('Requête abandonnée', 'AbortError'))
    }
    const minuteur = setTimeout(() => {
      signal?.removeEventListener('abort', arreter)
      resoudre()
    }, ms)
    signal?.addEventListener('abort', arreter, { once: true })
  })
}

/**
 * Le faux serveur : le même `Transport` que le HTTP, mais les réponses viennent de fonctions qui
 * lisent et écrivent le store. L'entrée et la sortie sont validées comme avec le vrai serveur.
 */
export function creerTransportDemo(options: OptionsTransportDemo): Transport {
  const { magasin, horloge, routes, delaiMs = 0 } = options
  return {
    async appeler(route, entree, appel) {
      if (magasin.lire().interrupteurs.horsConnexion) throw new ErreurReseau()
      if (appel?.signal?.aborted === true) {
        throw new DOMException('Requête abandonnée', 'AbortError')
      }
      const validee = validerEntree(route, entree)
      const nom = nomRoute(route)
      const reponse = routes[nom]
      if (reponse === undefined) {
        throw new ErreurApi({
          status: 501,
          code: 'erreur_interne',
          titre: 'Route de démo pas encore codée',
          detail: `La démo ne sait pas encore répondre à ${nom}.`,
        })
      }
      if (!SANS_SESSION.has(nom) && !magasin.lire().sessionOuverte) {
        throw new ErreurApi({
          status: 401,
          code: 'non_authentifie',
          titre: 'Non authentifié',
          detail: 'Connecte-toi pour continuer.',
        })
      }
      if (delaiMs > 0) await attendre(delaiMs, appel?.signal)
      return validerSortie(route, reponse({ magasin, horloge, entree: validee, route }))
    },
  }
}
