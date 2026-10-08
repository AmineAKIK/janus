import type { FastifyPluginAsync } from 'fastify'
import type { Dependances } from '../../types.ts'
import { creerControleurReglages } from './controleur.ts'
import { creerDepotReglages } from './depot.ts'
import { routesReglages } from './routes.ts'
import { creerServiceReglages } from './service.ts'

/** Branche les réglages : dépôt → service → contrôleur → routes. */
export function monterReglages({ base }: Dependances): FastifyPluginAsync {
  const service = creerServiceReglages({ base, depot: creerDepotReglages() })
  return routesReglages(creerControleurReglages(service))
}
