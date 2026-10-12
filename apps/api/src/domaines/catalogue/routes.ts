import { ROUTES } from '@janus/contrats'
import type { FastifyPluginAsync } from 'fastify'
import type { ControleurCatalogue } from './controleur.ts'
import { schemaDe } from '../../plugins/contrat.ts'

/** Le catalogue : formations, modules, blocs, et l'ouverture d'un bloc. Sous `/api`. */
export function routesCatalogue(controleur: ControleurCatalogue): FastifyPluginAsync {
  return (app) => {
    app.get(
      ROUTES['GET /formations'].chemin,
      { schema: schemaDe(ROUTES['GET /formations']) },
      controleur.formations,
    )
    app.get(
      ROUTES['GET /formations/:id/modules'].chemin,
      { schema: schemaDe(ROUTES['GET /formations/:id/modules']) },
      controleur.modules,
    )
    app.get(
      ROUTES['GET /modules/:id/blocs'].chemin,
      { schema: schemaDe(ROUTES['GET /modules/:id/blocs']) },
      controleur.blocsDuModule,
    )
    app.get(
      ROUTES['GET /blocs/:id'].chemin,
      { schema: schemaDe(ROUTES['GET /blocs/:id']) },
      controleur.bloc,
    )
    app.post(
      ROUTES['POST /blocs/:id/ouvrir'].chemin,
      { config: { identifiant: true }, schema: schemaDe(ROUTES['POST /blocs/:id/ouvrir']) },
      controleur.ouvrir,
    )
    return Promise.resolve()
  }
}
