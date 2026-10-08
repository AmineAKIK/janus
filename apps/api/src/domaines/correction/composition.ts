import type { FastifyPluginAsync } from 'fastify'
import { creerDeepseek } from '../../adaptateurs/correcteur/deepseek.ts'
import type { CorrigerPartie, Dependances } from '../../types.ts'
import { creerControleurCorrection } from './controleur.ts'
import { creerDepotCorrection } from './depot.ts'
import { routesCorrection } from './routes.ts'
import { creerServiceCorrection } from './service.ts'

export { validerSortie } from './policy.ts'

/** Assez pour un message de 1500 caractères et le JSON autour. */
const JETONS_SORTIE_MAX = 1000
const DELAI_CORRECTEUR_MS = 30_000

/** Branche la correction : dépôt → service → contrôleur → routes, et le correcteur choisi par la config. */
export function monterCorrection({ base, horloge, config, correcteur, hasard }: Dependances): {
  routes: FastifyPluginAsync
  corrigerPartie: CorrigerPartie
} {
  const cle = config.DEEPSEEK_API_KEY
  const service = creerServiceCorrection({
    base,
    depot: creerDepotCorrection(),
    horloge,
    correcteur:
      correcteur ??
      (cle === undefined
        ? undefined
        : creerDeepseek({
            cle,
            url: config.DEEPSEEK_URL,
            modele: config.DEEPSEEK_MODELE,
            temperature: config.DEEPSEEK_TEMPERATURE,
            delaiMs: DELAI_CORRECTEUR_MS,
            jetonsSortieMax: JETONS_SORTIE_MAX,
          })),
    tarifs: {
      entreeCache: config.DEEPSEEK_PRIX_ENTREE_CACHE,
      entree: config.DEEPSEEK_PRIX_ENTREE,
      sortie: config.DEEPSEEK_PRIX_SORTIE,
    },
    jetonsSortieMax: JETONS_SORTIE_MAX,
    hasard: hasard ?? Math.random,
  })
  return {
    routes: routesCorrection(creerControleurCorrection(service)),
    corrigerPartie: (userId, demande) =>
      service.corriger(userId, { ...demande, serie: 'verification', tentative: 1, relance: '' }),
  }
}
