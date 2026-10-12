import { ROUTES } from '@janus/contrats'
import type { FastifyPluginAsync } from 'fastify'
import type { ControleurRappels } from './controleur.ts'
import { schemaDe } from '../../plugins/contrat.ts'

/** Les abonnements aux rappels Web Push. Sous `/api`. */
export function routesRappels(controleur: ControleurRappels): FastifyPluginAsync {
  return (app) => {
    app.post(
      ROUTES['POST /push/abonnements'].chemin,
      { schema: schemaDe(ROUTES['POST /push/abonnements']), config: { identifiant: true } },
      controleur.abonner,
    )
    app.delete(
      ROUTES['DELETE /push/abonnements/:id'].chemin,
      { schema: schemaDe(ROUTES['DELETE /push/abonnements/:id']), config: { identifiant: false } },
      controleur.desabonner,
    )
    return Promise.resolve()
  }
}
