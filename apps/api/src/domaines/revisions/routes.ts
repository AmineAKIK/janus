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
    app.get(
      ROUTES['GET /cartes/dues'].chemin,
      { schema: schemaDe(ROUTES['GET /cartes/dues']) },
      controleur.cartesDues,
    )
    app.post(
      ROUTES['POST /cartes/:id/note'].chemin,
      {
        schema: schemaDe(ROUTES['POST /cartes/:id/note']),
        config: { identifiant: true },
      },
      controleur.noterCarte,
    )
    app.get(
      ROUTES['GET /verifications/:id'].chemin,
      { schema: schemaDe(ROUTES['GET /verifications/:id']) },
      controleur.verification,
    )
    app.post(
      ROUTES['POST /verifications/:id/reporter'].chemin,
      {
        schema: schemaDe(ROUTES['POST /verifications/:id/reporter']),
        config: { identifiant: true },
      },
      controleur.reporterVerification,
    )
    app.post(
      ROUTES['POST /verifications/:id/reponses'].chemin,
      {
        schema: schemaDe(ROUTES['POST /verifications/:id/reponses']),
        config: { identifiant: true },
      },
      controleur.repondre,
    )
    return Promise.resolve()
  }
}
