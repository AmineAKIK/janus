import { ROUTES } from '@janus/contrats'
import type { DefinitionRoute } from '@janus/contrats'
import type { FastifyPluginAsync } from 'fastify'
import type { ControleurSuivi } from './controleur.ts'

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

/** Le suivi : tableau de bord, journal, exports. Sous `/api`. */
export function routesSuivi(controleur: ControleurSuivi): FastifyPluginAsync {
  return (app) => {
    app.get(
      ROUTES['GET /tableau-de-bord'].chemin,
      { schema: schemaDe(ROUTES['GET /tableau-de-bord']) },
      controleur.tableauDeBord,
    )
    return Promise.resolve()
  }
}
