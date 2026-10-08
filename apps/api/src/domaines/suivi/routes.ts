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
    app.get(
      ROUTES['GET /journal'].chemin,
      { schema: schemaDe(ROUTES['GET /journal']) },
      controleur.journal,
    )
    // La réponse est du texte brut : le schéma de sortie est celui du contrat, mais il ne sérialise pas.
    app.get(ROUTES['GET /journal/export.txt'].chemin, controleur.exportTexte)
    app.post(
      ROUTES['POST /journal/notes'].chemin,
      { schema: schemaDe(ROUTES['POST /journal/notes']), config: { identifiant: true } },
      controleur.ajouterNote,
    )
    app.patch(
      ROUTES['PATCH /journal/notes/:id'].chemin,
      { schema: schemaDe(ROUTES['PATCH /journal/notes/:id']), config: { identifiant: false } },
      controleur.modifierNote,
    )
    app.post(
      ROUTES['POST /journal/idees'].chemin,
      { schema: schemaDe(ROUTES['POST /journal/idees']), config: { identifiant: true } },
      controleur.ajouterIdee,
    )
    app.post(
      ROUTES['POST /revues-methode'].chemin,
      { schema: schemaDe(ROUTES['POST /revues-methode']), config: { identifiant: true } },
      controleur.ajouterRevue,
    )
    return Promise.resolve()
  }
}
