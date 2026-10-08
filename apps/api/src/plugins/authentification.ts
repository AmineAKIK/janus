import type { FastifyInstance } from 'fastify'
import { ErreurProtocole } from '../erreurs.ts'
import type { Dependances } from '../types.ts'

/** Toute route exige une session, sauf celles qui se déclarent `publique` (connexion, santé). */
export function authentification(app: FastifyInstance, { observer }: Dependances): void {
  app.addHook('onRequest', (requete, _reponse, fini) => {
    observer?.('authentification')
    if (requete.routeOptions.config.publique !== true && requete.session.utilisateur === null) {
      fini(
        new ErreurProtocole(
          401,
          'non_authentifie',
          'Non authentifié',
          'Connecte-toi pour continuer.',
        ),
      )
      return
    }
    fini()
  })
}
