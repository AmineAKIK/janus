import { ROUTES } from '@janus/contrats'
import type { FastifyPluginAsync } from 'fastify'
import type { ControleurEvenements } from './controleur.ts'
import { schemaDe } from '../../plugins/contrat.ts'

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
    app.post(
      ROUTES['POST /blocs/:id/forcer'].chemin,
      { config: { identifiant: true }, schema: schemaDe(ROUTES['POST /blocs/:id/forcer']) },
      controleur.forcer,
    )
    app.post(
      ROUTES['POST /blocs/:id/erreurs'].chemin,
      { config: { identifiant: true }, schema: schemaDe(ROUTES['POST /blocs/:id/erreurs']) },
      controleur.erreur,
    )
    return Promise.resolve()
  }
}
