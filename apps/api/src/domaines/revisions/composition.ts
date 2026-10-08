import type { FastifyPluginAsync } from 'fastify'
import type { CorrigerPartie, Dependances } from '../../types.ts'
import { creerControleurRevisions } from './controleur.ts'
import { creerDepotRevisions } from './depot.ts'
import { routesRevisions } from './routes.ts'
import { creerServiceRevisions } from './service.ts'

/** Branche les routes de la séance du jour : dépôt → service → contrôleur → routes. */
export function monterRevisions(
  { base, horloge }: Dependances,
  corrigerPartie: CorrigerPartie,
): FastifyPluginAsync {
  const service = creerServiceRevisions({
    base,
    depot: creerDepotRevisions(),
    horloge,
    corrigerPartie,
  })
  return routesRevisions(creerControleurRevisions(service))
}
