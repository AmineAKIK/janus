import type { FastifyInstance, FastifyRequest } from 'fastify'
import { nomDuCookie } from './cookie.ts'
import type { Dependances, ResoudreSession, Session } from '../types.ts'

const SESSION_VIDE: Session = { utilisateur: null, sessionId: null }

/** La session de chaque requête : celle que désigne le cookie de session, ou une session vide. */
export function session(
  app: FastifyInstance,
  { observer, config }: Dependances,
  resoudre: ResoudreSession,
): void {
  const nomCookie = nomDuCookie(config.COOKIE_SECURE)
  const sessions = new WeakMap<FastifyRequest, Session>()
  app.decorateRequest('session', {
    getter(this: FastifyRequest) {
      return sessions.get(this) ?? SESSION_VIDE
    },
  })
  app.addHook('onRequest', async (requete) => {
    observer?.('session')
    sessions.set(requete, await resoudre(requete.cookies[nomCookie]))
  })
}
