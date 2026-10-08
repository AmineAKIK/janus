import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { Dependances, ResoudreSession, Session } from '../types.ts'

const NOM_COOKIE = 'janus_session'
const SESSION_VIDE: Session = { utilisateur: null, sessionId: null }

/** La session de chaque requête : celle que désigne le cookie `janus_session`, ou une session vide. */
export function session(
  app: FastifyInstance,
  { observer }: Dependances,
  resoudre: ResoudreSession,
): void {
  const sessions = new WeakMap<FastifyRequest, Session>()
  app.decorateRequest('session', {
    getter(this: FastifyRequest) {
      return sessions.get(this) ?? SESSION_VIDE
    },
  })
  app.addHook('onRequest', async (requete) => {
    observer?.('session')
    sessions.set(requete, await resoudre(requete.cookies[NOM_COOKIE]))
  })
}
