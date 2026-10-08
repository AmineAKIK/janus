import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import type { ControleurSante } from './controleur.ts'

const EtatSante = z.strictObject({ ok: z.boolean(), base: z.boolean() })

/** `GET /api/sante` : 200 `{ ok: true, base: true }` si la base répond, 503 sinon. Sans connexion. */
export function routesSante(controleur: ControleurSante): FastifyPluginAsync {
  return (app) => {
    app.get(
      '/sante',
      { config: { publique: true }, schema: { response: { 200: EtatSante, 503: EtatSante } } },
      controleur.sante,
    )
    return Promise.resolve()
  }
}
