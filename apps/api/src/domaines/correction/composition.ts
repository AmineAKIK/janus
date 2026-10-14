import type { FastifyPluginAsync } from 'fastify'
import type { Base } from '../../base/base.ts'
import { correcteurDeLaConfig } from '../../adaptateurs/correcteur/choix.ts'
import { ErreurConfig } from '../../config.ts'
import type { CorrigerPartie, Dependances } from '../../types.ts'
import { creerControleurCorrection } from './controleur.ts'
import { creerDepotCorrection } from './depot.ts'
import { routesCorrection } from './routes.ts'
import { creerServiceCorrection } from './service.ts'

export { validerSortie } from './policy.ts'

/** Au démarrage aucun appel n'est en vol : les réservations restantes viennent d'un arrêt brutal. */
export async function libererLesReservations(base: Base): Promise<void> {
  await creerDepotCorrection().libererLesReservations(base.db)
}

/** Assez pour un message de 1500 caractères et le JSON autour. */
const JETONS_SORTIE_MAX = 1000
const DELAI_CORRECTEUR_MS = 30_000

/**
 * Branche la correction : dépôt → service → contrôleur → routes, et le correcteur choisi par la config.
 * Sans correcteur (ni injecté, ni créé faute de clé), l'API refuse de démarrer : un serveur qui répond
 * « correction indisponible » à chaque question passerait le contrôle de santé du déploiement.
 */
export function monterCorrection({ base, horloge, config, correcteur, hasard }: Dependances): {
  routes: FastifyPluginAsync
  corrigerPartie: CorrigerPartie
} {
  const choix = correcteurDeLaConfig(config, {
    delaiMs: DELAI_CORRECTEUR_MS,
    jetonsSortieMax: JETONS_SORTIE_MAX,
  })
  const actif = correcteur ?? choix.correcteur
  if (actif === undefined) {
    const cle = config.CORRECTEUR === 'claude' ? 'ANTHROPIC_API_KEY' : 'DEEPSEEK_API_KEY'
    throw new ErreurConfig([
      `Le correcteur « ${config.CORRECTEUR} » n’a pas sa clé : ${cle} est vide ou absente. Sans correction, l’API ne démarre pas.`,
    ])
  }
  const service = creerServiceCorrection({
    base,
    depot: creerDepotCorrection(),
    horloge,
    correcteur: actif,
    tarifs: choix.tarifs,
    jetonsSortieMax: JETONS_SORTIE_MAX,
    hasard: hasard ?? Math.random,
  })
  return {
    routes: async (app, options) => {
      await routesCorrection(creerControleurCorrection(service), config.CORRECTIONS_PAR_MINUTE)(
        app,
        options,
      )
    },
    corrigerPartie: (userId, demande) =>
      service.corriger(userId, { ...demande, serie: 'verification', tentative: 1, relance: '' }),
  }
}
