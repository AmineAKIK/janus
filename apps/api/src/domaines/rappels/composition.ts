import type { FastifyPluginAsync } from 'fastify'
import { creerWebPush } from '../../adaptateurs/push/webpush.ts'
import type { BilanDesRappels, Dependances, LireAujourdhui } from '../../types.ts'
import { creerControleurRappels } from './controleur.ts'
import { creerDepotRappels } from './depot.ts'
import { routesRappels } from './routes.ts'
import { creerServiceRappels } from './service.ts'

/** Branche les rappels : dépôt → service → contrôleur → routes, et la tâche qui les envoie. */
export function monterRappels(
  { base, horloge, envoyeur, config }: Dependances,
  aujourdhui: LireAujourdhui,
): { routes: FastifyPluginAsync; envoyerLesRappels: () => Promise<BilanDesRappels> } {
  const service = creerServiceRappels({
    base,
    depot: creerDepotRappels(),
    horloge,
    envoyeur:
      envoyeur ??
      creerWebPush({
        sujet: config.VAPID_SUJET,
        clePublique: config.VAPID_PUBLIC_KEY,
        clePrivee: config.VAPID_PRIVATE_KEY,
      }),
    aujourdhui,
  })
  return {
    routes: routesRappels(creerControleurRappels(service)),
    envoyerLesRappels: () => service.envoyerLesRappels(),
  }
}
