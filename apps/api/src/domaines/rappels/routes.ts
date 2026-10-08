import { ROUTES } from '@janus/contrats'
import type { DefinitionRoute } from '@janus/contrats'
import type { FastifyPluginAsync } from 'fastify'
import type { ControleurRappels } from './controleur.ts'

/** Le schéma Fastify d'une route du contrat : entrée validée, sortie filtrée. */
function schemaDe(definition: DefinitionRoute) {
  return {
    ...(definition.params === undefined ? {} : { params: definition.params }),
    ...(definition.requete === undefined ? {} : { querystring: definition.requete }),
    ...(definition.corps === undefined ? {} : { body: definition.corps }),
    ...(definition.reponse === null
      ? {}
      : { response: { [definition.succes]: definition.reponse } }),
  }
}

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
