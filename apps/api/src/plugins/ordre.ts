import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import etag from '@fastify/etag'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import type { FastifyInstance } from 'fastify'
import type { Dependances, NomMiddleware } from '../types.ts'
import { authentification } from './authentification.ts'
import { gestionnaireErreurs } from './gestionnaireErreurs.ts'
import { identifiantRequete } from './identifiantRequete.ts'
import { journalFin } from './journalFin.ts'
import { limitesParRoute, marquerLimites } from './limites.ts'
import { origine } from './origine.ts'
import { session } from './session.ts'
import { exigerDeclarationIdentifiant, identifiantEcriture, validation } from './validation.ts'

/** Le plafond général de requêtes, par adresse et par minute. */
export const REQUETES_PAR_MINUTE = 300

/** Un point de passage pour un middleware d'un plugin tiers, qui ne sait pas appeler l'observateur. */
function passage(app: FastifyInstance, nom: NomMiddleware, { observer }: Dependances): void {
  app.addHook('onRequest', (_requete, _reponse, fini) => {
    observer?.(nom)
    fini()
  })
}

/**
 * La chaîne de middlewares, dans l'ordre exact de l'architecture. C'est le seul fichier qui
 * déclare un middleware : chaque ligne ci-dessous est une étape, et l'ordre des lignes est l'ordre
 * des passages (les crochets de même étape de cycle de vie Fastify s'exécutent dans l'ordre où ils
 * sont ajoutés, `await register` charge chaque plugin avant la ligne suivante).
 */
export async function declarerMiddlewares(app: FastifyInstance, dependances: Dependances) {
  // 1. Identifiant de requête et journal pino.
  identifiantRequete(app, dependances)
  // 2. Limite de corps et délai.
  limitesParRoute(app)
  marquerLimites(app, dependances)
  // 3. En-têtes de sécurité.
  await app.register(helmet, { global: true })
  passage(app, 'helmet', dependances)
  // 4. CORS fermé : aucune autre origine n'est autorisée.
  await app.register(cors, { origin: false })
  passage(app, 'cors', dependances)
  // 5. Limite de débit générale.
  await app.register(rateLimit, {
    global: true,
    max: REQUETES_PAR_MINUTE,
    timeWindow: '1 minute',
    keyGenerator: (requete) => requete.ip,
  })
  passage(app, 'limite_debit', dependances)
  // 6. Cookie et session (vide jusqu'à PR-082).
  await app.register(cookie)
  session(app, dependances)
  // 7. Origine des écritures.
  origine(app, dependances)
  // 8. Authentification.
  authentification(app, dependances)
  // 9. Validation Zod d'entrée, filtrage de sortie.
  validation(app, dependances)
  // 10. Une écriture porte son identifiant.
  exigerDeclarationIdentifiant(app)
  identifiantEcriture(app, dependances)
  // 11. Gestionnaire d'erreurs.
  gestionnaireErreurs(app, dependances)
  // + ETag sur les GET (hors chaîne des 12).
  await app.register(etag)
  app.addHook('onSend', (requete, reponse, _contenu, fini) => {
    dependances.observer?.('etag')
    if (requete.method !== 'GET' || reponse.statusCode >= 400) reponse.removeHeader('etag')
    fini()
  })
  // 12. Journal de fin de requête.
  journalFin(app, dependances)
}
