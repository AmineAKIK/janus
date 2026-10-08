import type { FastifyInstance } from 'fastify'
import type { Dependances, Session } from '../types.ts'

const SESSION_VIDE: Session = { utilisateur: null }

/** La session de la requête. Branchée sur le cookie en PR-082 ; ici elle est toujours vide. */
export function session(app: FastifyInstance, { observer }: Dependances): void {
  app.decorateRequest('session', { getter: () => SESSION_VIDE })
  app.addHook('onRequest', (_requete, _reponse, fini) => {
    observer?.('session')
    fini()
  })
}
