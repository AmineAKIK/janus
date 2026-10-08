import { ROUTES } from '@janus/contrats'
import type { DefinitionRoute } from '@janus/contrats'
import type { FastifyPluginAsync } from 'fastify'
import type { ControleurReglages } from './controleur.ts'

/** Le schéma Fastify d'une route du contrat : entrée validée, sortie filtrée. */
function schemaDe(definition: DefinitionRoute) {
  return {
    ...(definition.params === undefined ? {} : { params: definition.params }),
    ...(definition.corps === undefined ? {} : { body: definition.corps }),
    ...(definition.reponse === null
      ? {}
      : { response: { [definition.succes]: definition.reponse } }),
  }
}

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
