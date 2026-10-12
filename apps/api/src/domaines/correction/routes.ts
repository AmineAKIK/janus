import { ROUTES } from '@janus/contrats'
import type { FastifyPluginAsync } from 'fastify'
import type { ControleurCorrection } from './controleur.ts'
import { schemaDe } from '../../plugins/contrat.ts'

/** La correction par l'IA. Sous `/api`. */
export function routesCorrection(
  controleur: ControleurCorrection,
  correctionsParMinute: number,
): FastifyPluginAsync {
  return (app) => {
    app.post(
      ROUTES['POST /corrections'].chemin,
      {
        // Le plafond horaire en base borne le coût ; celui-ci borne la rafale.
        config: {
          identifiant: true,
          rateLimit: { max: correctionsParMinute, timeWindow: '1 minute' },
        },
        schema: schemaDe(ROUTES['POST /corrections']),
      },
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
