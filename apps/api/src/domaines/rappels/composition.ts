import type { FastifyPluginAsync } from 'fastify'
import type { BilanDesRappels, Dependances, LireAujourdhui } from '../../types.ts'
import { creerControleurRappels } from './controleur.ts'
import { creerDepotRappels } from './depot.ts'
import { routesRappels } from './routes.ts'
import { creerServiceRappels } from './service.ts'

/** Branche les rappels : dépôt → service → contrôleur → routes, et la tâche qui les envoie. */
export function monterRappels(
  { base, horloge, envoyeur }: Dependances,
  aujourdhui: LireAujourdhui,
): { routes: FastifyPluginAsync; envoyerLesRappels: () => Promise<BilanDesRappels> } {
  const service = creerServiceRappels({
    base,
    depot: creerDepotRappels(),
    horloge,
    envoyeur: envoyeur ?? {
      envoyer: () => Promise.reject(new Error('Aucun envoyeur de notifications n’est branché.')),
    },
    aujourdhui,
  })
  return {
    routes: routesRappels(creerControleurRappels(service)),
    envoyerLesRappels: () => service.envoyerLesRappels(),
  }
}
