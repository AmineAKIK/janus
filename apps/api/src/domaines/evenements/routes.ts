import { ROUTES } from '@janus/contrats'
import type { DefinitionRoute } from '@janus/contrats'
import type { FastifyPluginAsync } from 'fastify'
import type { ControleurEvenements } from './controleur.ts'

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

/** Les événements de la page et l'état de page. Sous `/api`. */
export function routesEvenements(controleur: ControleurEvenements): FastifyPluginAsync {
  return (app) => {
    app.post(
      ROUTES['POST /evenements'].chemin,
      { config: { identifiant: true }, schema: schemaDe(ROUTES['POST /evenements']) },
      controleur.evenement,
    )
    app.put(
      ROUTES['PUT /blocs/:id/etat-page'].chemin,
      { config: { identifiant: false }, schema: schemaDe(ROUTES['PUT /blocs/:id/etat-page']) },
      controleur.etatPage,
    )
    return Promise.resolve()
  }
}
