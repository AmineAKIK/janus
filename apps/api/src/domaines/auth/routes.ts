import { ROUTES } from '@janus/contrats'
import type { DefinitionRoute } from '@janus/contrats'
import type { FastifyPluginAsync } from 'fastify'
import type { ControleurAuth } from './controleur.ts'

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

/** Les routes du compte : connexion, sessions, mot de passe, suppression. Sous `/api`. */
export function routesAuth(controleur: ControleurAuth): FastifyPluginAsync {
  return (app) => {
    app.post(
      ROUTES['POST /session'].chemin,
      { config: { publique: true, identifiant: false }, schema: schemaDe(ROUTES['POST /session']) },
      controleur.connecter,
    )
    app.delete(
      ROUTES['DELETE /session'].chemin,
      { config: { identifiant: false }, schema: schemaDe(ROUTES['DELETE /session']) },
      controleur.deconnecter,
    )
    app.get(ROUTES['GET /moi'].chemin, { schema: schemaDe(ROUTES['GET /moi']) }, controleur.moi)
    app.get(
      ROUTES['GET /sessions'].chemin,
      { schema: schemaDe(ROUTES['GET /sessions']) },
      controleur.sessions,
    )
    app.delete(
      ROUTES['DELETE /sessions/:id'].chemin,
      { config: { identifiant: false }, schema: schemaDe(ROUTES['DELETE /sessions/:id']) },
      controleur.revoquer,
    )
    app.patch(
      ROUTES['PATCH /moi/mot-de-passe'].chemin,
      { config: { identifiant: false }, schema: schemaDe(ROUTES['PATCH /moi/mot-de-passe']) },
      controleur.changerMotDePasse,
    )
    app.delete(
      ROUTES['DELETE /compte'].chemin,
      { config: { identifiant: false }, schema: schemaDe(ROUTES['DELETE /compte']) },
      controleur.supprimerCompte,
    )
    return Promise.resolve()
  }
}
