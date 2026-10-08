import { randomUUID } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import type { FastifyInstance } from 'fastify'
import type { Dependances } from '../types.ts'

const IDENTIFIANT_VALIDE = /^[A-Za-z0-9_-]{1,64}$/

/**
 * L'identifiant de la requête : celui de l'en-tête `x-request-id` s'il est sain (il finit dans le
 * journal), sinon un UUID tiré ici.
 */
export function genererIdentifiant(requete: IncomingMessage): string {
  const recu = requete.headers['x-request-id']
  return typeof recu === 'string' && IDENTIFIANT_VALIDE.test(recu) ? recu : randomUUID()
}

/** Rend l'identifiant dans `x-request-id` ; le journal pino le porte déjà (`reqId`). */
export function identifiantRequete(app: FastifyInstance, { observer }: Dependances): void {
  app.addHook('onRequest', (requete, reponse, fini) => {
    observer?.('identifiant_requete')
    reponse.header('x-request-id', requete.id)
    fini()
  })
}
