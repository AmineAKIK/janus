import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import { monterAuth } from './domaines/auth/composition.ts'
import type { OptionsAuth } from './domaines/auth/composition.ts'
import { monterCatalogue } from './domaines/catalogue/composition.ts'
import { monterCorrection } from './domaines/correction/composition.ts'
import { monterEvenements } from './domaines/evenements/composition.ts'
import { monterRevisions } from './domaines/revisions/composition.ts'
import { monterSante } from './domaines/sante/composition.ts'
import { genererIdentifiant } from './plugins/identifiantRequete.ts'
import { declarerMiddlewares } from './plugins/ordre.ts'
import type { Dependances } from './types.ts'

export interface OptionsServeur extends OptionsAuth {
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
  const auth = monterAuth(dependances, options)
  await declarerMiddlewares(app, dependances, auth.resoudreSession)
  await app.register(monterSante(dependances.base), { prefix: '/api' })
  await app.register(auth.routes, { prefix: '/api' })
  await app.register(monterCatalogue(dependances), { prefix: '/api' })
  await app.register(monterEvenements(dependances), { prefix: '/api' })
  const correction = monterCorrection(dependances)
  await app.register(correction.routes, { prefix: '/api' })
  await app.register(monterRevisions(dependances, correction.corrigerPartie), { prefix: '/api' })
  return app
}
