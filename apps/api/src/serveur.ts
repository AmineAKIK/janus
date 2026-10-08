import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import { monterSante } from './domaines/sante/composition.ts'
import { genererIdentifiant } from './plugins/identifiantRequete.ts'
import { declarerMiddlewares } from './plugins/ordre.ts'
import type { Dependances } from './types.ts'

export interface OptionsServeur {
  /** Où va le journal pino ; la sortie standard par défaut. */
  readonly fluxJournal?: { write(ligne: string): void }
}

/** Le serveur Fastify : la chaîne de middlewares, puis les routes sous `/api`. */
export async function creerServeur(
  dependances: Dependances,
  options: OptionsServeur = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: dependances.config.NIVEAU_JOURNAL,
      ...(options.fluxJournal === undefined ? {} : { stream: options.fluxJournal }),
    },
    genReqId: genererIdentifiant,
    // Le proxy de l'hébergeur est le seul devant l'API : son `x-forwarded-for` fait foi.
    trustProxy: true,
  })
  await declarerMiddlewares(app, dependances)
  await app.register(monterSante(dependances.base), { prefix: '/api' })
  return app
}
