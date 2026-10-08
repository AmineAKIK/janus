import type { FastifyPluginAsync } from 'fastify'
import type { Dependances } from '../../types.ts'
import { creerControleurEvenements } from './controleur.ts'
import { creerDepotEvenements } from './depot.ts'
import { routesEvenements } from './routes.ts'
import { creerServiceEvenements } from './service.ts'

/** Branche les routes des événements : dépôt → service → contrôleur → routes. */
export function monterEvenements({ base, horloge }: Dependances): FastifyPluginAsync {
  const service = creerServiceEvenements({ base, depot: creerDepotEvenements(), horloge })
  return routesEvenements(creerControleurEvenements(service))
}
