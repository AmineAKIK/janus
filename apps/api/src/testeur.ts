import type { FastifyInstance } from 'fastify'
import { creerBase } from './base/base.ts'
import type { Base } from './base/base.ts'
import { lireConfig } from './config.ts'
import type { Envoyeur } from './adaptateurs/push/envoyeur.ts'
import type { Correcteur } from './adaptateurs/correcteur/correcteur.ts'
import type { Hacheur } from './domaines/auth/composition.ts'
import type { Config } from './config.ts'
import type { Horloge } from './horloge.ts'
import { creerServeur } from './serveur.ts'
import type { NomMiddleware, SignalerErreur } from './types.ts'

// Aides des tests de l'API : un serveur complet, une base factice, une horloge et un journal qu'on lit.

export const ORIGINE_TEST = 'https://appli.test'

export const ENVIRONNEMENT_TEST = {
  DATABASE_URL: 'postgres://janus@localhost/janus_test',
  DATABASE_URL_PROPRIETAIRE: 'postgres://janus@localhost/janus_test',
  ORIGINE_APPLI: ORIGINE_TEST,
  FICHES_URL: 'https://fiches.test',
  COOKIE_SECURE: 'true',
  VAPID_PUBLIC_KEY: 'publique',
  VAPID_PRIVATE_KEY: 'privee',
  VAPID_SUJET: 'mailto:amine@example.test',
  NIVEAU_JOURNAL: 'info',
}

export function configDeTest(surcharge: Readonly<Record<string, string>> = {}): Config {
  return lireConfig({ ...ENVIRONNEMENT_TEST, ...surcharge })
}

/** Une base qui répond (ou non) au `SELECT 1`. */
export function baseFactice(repond = true): Base & { readonly requetes: string[] } {
  const requetes: string[] = []
  // Une vraie connexion paresseuse qui ne s'ouvre jamais : seules les requêtes factices répondent.
  return {
    ...creerBase('postgres://janus@localhost/janus_factice'),
    requetes,
    requete: (texte) => {
      requetes.push(texte)
      return repond
        ? Promise.resolve({ rows: [{ '?column?': 1 }] })
        : Promise.reject(new Error('base coupée'))
    },
    fermer: () => Promise.resolve(),
  }
}

/** Une horloge qui n'avance que quand on le demande. */
export function horlogeFausse(debut = '2026-10-01T10:00:00.000Z') {
  let ms = Date.parse(debut)
  let chrono = 0
  return {
    maintenant: () => new Date(ms).toISOString(),
    chrono: () => chrono,
    /** Place l'horloge à cet instant (les cas d'acceptation rejouent des dates passées). */
    placer: (instant: string) => {
      ms = Date.parse(instant)
    },
    avancer: (millisecondes: number) => {
      ms += millisecondes
      chrono += millisecondes
    },
  } satisfies Horloge & { avancer: (ms: number) => void; placer: (instant: string) => void }
}

export interface ServeurDeTest {
  readonly app: FastifyInstance
  readonly passages: NomMiddleware[]
  readonly journal: Record<string, unknown>[]
  readonly base: ReturnType<typeof baseFactice>
  readonly horloge: ReturnType<typeof horlogeFausse>
}

/** Un serveur complet, prêt pour `app.inject`, qui note les passages des middlewares et le journal. */
export async function serveurDeTest(
  options: {
    readonly baseRepond?: boolean
    readonly config?: Config
    readonly base?: Base
    readonly proprietaire?: Base
    readonly hacheur?: Hacheur
    readonly correcteur?: Correcteur
    readonly envoyeur?: Envoyeur
    readonly hasard?: () => number
    readonly signalerErreur?: SignalerErreur
  } = {},
): Promise<ServeurDeTest> {
  const passages: NomMiddleware[] = []
  const journal: Record<string, unknown>[] = []
  const factice = baseFactice(options.baseRepond ?? true)
  const base = options.base ?? factice
  const horloge = horlogeFausse()
  const app = await creerServeur(
    {
      config: options.config ?? configDeTest(),
      horloge,
      base,
      proprietaire: options.proprietaire ?? base,
      ...(options.correcteur === undefined ? {} : { correcteur: options.correcteur }),
      ...(options.envoyeur === undefined ? {} : { envoyeur: options.envoyeur }),
      ...(options.hasard === undefined ? {} : { hasard: options.hasard }),
      ...(options.signalerErreur === undefined ? {} : { signalerErreur: options.signalerErreur }),
      observer: (nom) => passages.push(nom),
    },
    {
      ...(options.hacheur === undefined ? {} : { hacheur: options.hacheur }),
      fluxJournal: {
        write: (ligne) => {
          const lue: unknown = JSON.parse(ligne)
          if (typeof lue === 'object' && lue !== null) journal.push({ ...lue })
        },
      },
    },
  )
  return { app, passages, journal, base: factice, horloge }
}
