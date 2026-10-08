import { ROUTES } from '@janus/contrats'
import type { DefinitionRoute } from '@janus/contrats'
import type { FastifyPluginAsync } from 'fastify'
import type { ControleurCorrection } from './controleur.ts'

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

/** La correction par l'IA. Sous `/api`. */
export function routesCorrection(controleur: ControleurCorrection): FastifyPluginAsync {
  return (app) => {
    app.post(
      ROUTES['POST /corrections'].chemin,
      { config: { identifiant: true }, schema: schemaDe(ROUTES['POST /corrections']) },
      controleur.corriger,
    )
    app.post(
      ROUTES['POST /corrections/:id/accord'].chemin,
      {
        config: { identifiant: false },
        schema: schemaDe(ROUTES['POST /corrections/:id/accord']),
      },
      controleur.accord,
    )
    app.post(
      ROUTES['POST /corrections/:id/trancher'].chemin,
      {
        config: { identifiant: true },
        schema: schemaDe(ROUTES['POST /corrections/:id/trancher']),
      },
      controleur.trancher,
    )
    return Promise.resolve()
  }
}
