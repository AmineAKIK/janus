import { ROUTES } from '@janus/contrats'
import type { DefinitionRoute } from '@janus/contrats'
import type { FastifyPluginAsync } from 'fastify'
import type { ControleurRevisions } from './controleur.ts'

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

/** La séance du jour : questions de début, cartes, vérifications. Sous `/api`. */
export function routesRevisions(controleur: ControleurRevisions): FastifyPluginAsync {
  return (app) => {
    app.get(
      ROUTES['GET /questions-debut'].chemin,
      { schema: schemaDe(ROUTES['GET /questions-debut']) },
      controleur.questionsDebut,
    )
    return Promise.resolve()
  }
}
