import type { FastifyPluginAsync } from 'fastify'
import type { CacheDesEtats } from '../../base/etatsDesBlocs.ts'
import type { Dependances, LireAujourdhui } from '../../types.ts'
import { creerControleurSuivi } from './controleur.ts'
import { creerDepotSuivi } from './depot.ts'
import { routesSuivi } from './routes.ts'
import { creerServiceSuivi } from './service.ts'

/** Branche le suivi : dépôt → service → contrôleur → routes. */
export function monterSuivi(
  { base, horloge }: Dependances,
  aujourdhui: LireAujourdhui,
  etats: CacheDesEtats,
): FastifyPluginAsync {
  const service = creerServiceSuivi({ base, depot: creerDepotSuivi(), horloge, aujourdhui, etats })
  return routesSuivi(creerControleurSuivi(service))
}
