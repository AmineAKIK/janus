import type { FastifyInstance, RouteOptions } from 'fastify'
import type { Dependances } from '../types.ts'

const KO = 1024
export const LIMITE_CORPS_DEFAUT = 64 * KO
export const DELAI_DEFAUT_MS = 15_000

/** Les routes qui ont droit à plus que la limite générale. */
export const EXCEPTIONS_LIMITES: readonly {
  readonly methode: string
  readonly chemin: string
  readonly corpsOctets?: number
  readonly delaiMs?: number
}[] = [
  { methode: 'PUT', chemin: '/api/blocs/:id/etat-page', corpsOctets: 256 * KO },
  { methode: 'POST', chemin: '/api/corrections', delaiMs: 75_000 },
]

/** Donne à chaque route sa limite de corps et son délai, à la déclaration de la route. */
export function limitesParRoute(app: FastifyInstance): void {
  app.addHook('onRoute', (route: RouteOptions) => {
    const methodes = [route.method].flat()
    const exception = EXCEPTIONS_LIMITES.find(
      ({ methode, chemin }) => chemin === route.url && methodes.includes(methode),
    )
    route.bodyLimit ??= exception?.corpsOctets ?? LIMITE_CORPS_DEFAUT
    route.handlerTimeout ??= exception?.delaiMs ?? DELAI_DEFAUT_MS
  })
}

/** Passage de la requête : les limites elles-mêmes sont appliquées par Fastify, route par route. */
export function marquerLimites(app: FastifyInstance, { observer }: Dependances): void {
  app.addHook('onRequest', (_requete, _reponse, fini) => {
    observer?.('limites')
    fini()
  })
}
