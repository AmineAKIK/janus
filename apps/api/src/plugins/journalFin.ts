import type { FastifyInstance } from 'fastify'
import type { Dependances } from '../types.ts'

/** Une ligne de journal par requête terminée : méthode, route, statut, durée. */
export function journalFin(app: FastifyInstance, { horloge, observer }: Dependances): void {
  app.decorateRequest('debutChrono', 0)
  app.addHook('onRequest', (requete, _reponse, fini) => {
    requete.debutChrono = horloge.chrono()
    fini()
  })
  app.addHook('onResponse', (requete, reponse, fini) => {
    observer?.('journal_fin')
    requete.log.info(
      {
        methode: requete.method,
        route: requete.routeOptions.url,
        statut: reponse.statusCode,
        dureeMs: Math.round(horloge.chrono() - requete.debutChrono),
      },
      'requête terminée',
    )
    fini()
  })
}
