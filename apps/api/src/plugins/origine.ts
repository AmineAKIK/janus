import type { FastifyInstance } from 'fastify'
import { ErreurProtocole } from '../erreurs.ts'
import type { Dependances } from '../types.ts'

const METHODES_D_ECRITURE = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Une écriture ne passe que si son en-tête `Origin` est exactement l'origine de l'appli. */
export function origine(app: FastifyInstance, { config, observer }: Dependances): void {
  const attendue = new URL(config.ORIGINE_APPLI).origin
  app.addHook('onRequest', (requete, _reponse, fini) => {
    observer?.('origine')
    if (METHODES_D_ECRITURE.has(requete.method) && requete.headers.origin !== attendue) {
      fini(
        new ErreurProtocole(
          403,
          'origine_refusee',
          'Origine refusée',
          'Cette requête ne vient pas de l’appli.',
        ),
      )
      return
    }
    fini()
  })
}
