import type { FastifyInstance, RouteOptions } from 'fastify'
import type { Dependances } from '../types.ts'

const KO = 1024
export const LIMITE_CORPS_DEFAUT = 64 * KO
export const DELAI_DEFAUT_MS = 15_000
/**
 * Le plus long délai qu'un minuteur de Node accepte (24 jours) : pour une réponse en flux. Fastify ne
 * retire pas son minuteur quand la réponse est un flux entamé : passé le délai il tente un 503 sur des
 * en-têtes déjà partis (`ERR_HTTP_HEADERS_SENT`) et le processus s'arrête. Un flux plus long que le délai
 * (un export de 300 Mo sur une connexion lente) ne doit donc pas en avoir.
 */
export const DELAI_DU_FLUX_MS = 2_147_483_647

/** Les routes qui ont droit à plus que la limite générale. */
const EXCEPTIONS_LIMITES: readonly {
  readonly methode: string
  readonly chemin: string
  readonly corpsOctets?: number
  readonly delaiMs?: number
}[] = [
  { methode: 'PUT', chemin: '/api/blocs/:id/etat-page', corpsOctets: 256 * KO },
  { methode: 'POST', chemin: '/api/corrections', delaiMs: 75_000 },
  { methode: 'GET', chemin: '/api/export.json', delaiMs: DELAI_DU_FLUX_MS },
]

/** Donne à chaque route sa limite de corps et son délai, à la déclaration de la route. */
export function limitesParRoute(app: FastifyInstance): void {
  app.addHook('onRoute', (route: RouteOptions) => {
    const methodes = [route.method].flat()
    const exception = EXCEPTIONS_LIMITES.find(
      ({ methode, chemin }) =>
        chemin === route.url &&
        // Fastify déclare aussi une route HEAD pour chaque GET, qui exécute le même gestionnaire.
        (methodes.includes(methode) || (methode === 'GET' && methodes.includes('HEAD'))),
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
