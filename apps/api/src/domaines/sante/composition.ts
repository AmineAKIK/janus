import type { FastifyPluginAsync } from 'fastify'
import type { Base } from '../../base/base.ts'
import { creerControleurSante } from './controleur.ts'
import { creerDepotSante } from './depot.ts'
import { routesSante } from './routes.ts'
import { creerServiceSante } from './service.ts'

/** Branche les couches de la santé : dépôt → service → contrôleur → routes. */
export function monterSante(base: Base): FastifyPluginAsync {
  return routesSante(creerControleurSante(creerServiceSante(creerDepotSante(base))))
}
