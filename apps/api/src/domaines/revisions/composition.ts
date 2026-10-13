import type { FastifyPluginAsync } from 'fastify'
import type { CacheDesEtats } from '../../base/etatsDesBlocs.ts'
import type { CorrigerPartie, Dependances, LireAujourdhui } from '../../types.ts'
import { creerControleurRevisions } from './controleur.ts'
import { creerDepotRevisions } from './depot.ts'
import { routesRevisions } from './routes.ts'
import { creerServiceRevisions } from './service.ts'

/** Branche les routes de la séance du jour : dépôt → service → contrôleur → routes. */
export function monterRevisions(
  { base, horloge }: Dependances,
  corrigerPartie: CorrigerPartie,
  etats: CacheDesEtats,
): { routes: FastifyPluginAsync; aujourdhui: LireAujourdhui } {
  const service = creerServiceRevisions({
    base,
    depot: creerDepotRevisions(),
    horloge,
    corrigerPartie,
    etats,
  })
  return {
    routes: routesRevisions(creerControleurRevisions(service)),
    aujourdhui: (userId) => service.aujourdhui(userId),
  }
}
