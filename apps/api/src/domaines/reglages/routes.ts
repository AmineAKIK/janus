import { ROUTES } from '@janus/contrats'
import type { FastifyPluginAsync } from 'fastify'
import type { ControleurReglages } from './controleur.ts'
import { schemaDe } from '../../plugins/contrat.ts'

/** Les réglages de l'utilisateur. Sous `/api`. */
export function routesReglages(controleur: ControleurReglages): FastifyPluginAsync {
  return (app) => {
    app.get(
      ROUTES['GET /reglages'].chemin,
      { schema: schemaDe(ROUTES['GET /reglages']) },
      controleur.lire,
    )
    app.patch(
      ROUTES['PATCH /reglages'].chemin,
      { schema: schemaDe(ROUTES['PATCH /reglages']), config: { identifiant: false } },
      controleur.modifier,
    )
    return Promise.resolve()
  }
}
