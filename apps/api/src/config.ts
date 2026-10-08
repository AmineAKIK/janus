import { z } from 'zod'

const Booleen = z.enum(['true', 'false']).transform((valeur) => valeur === 'true')

/** Les variables d'environnement de l'API, lues et validées une seule fois au démarrage. */
export const SchemaConfig = z.object({
  /** La connexion de l'API : le rôle `janus_app`, sans UPDATE ni DELETE sur les faits. */
  DATABASE_URL: z.string().min(1),
  /** Le rôle propriétaire : seule la suppression d'un compte l'utilise. */
  DATABASE_URL_PROPRIETAIRE: z.string().min(1),
  /** L'origine exacte de l'appli (`https://exemple.fr`), la seule autorisée à écrire. */
  ORIGINE_APPLI: z.url(),
  /** L'adresse (sans barre finale ou avec) d'où les fiches sont servies : `<FICHES_URL>/<code>/<empreinte>.html`. */
  FICHES_URL: z.url(),
  COOKIE_SECURE: Booleen,
  /** Facultative en test : sans elle, la correction par l'IA est indisponible. */
  DEEPSEEK_API_KEY: z.string().min(1).optional(),
  /** Le modèle de correction (`deepseek-flash` à la date du cadrage). */
  DEEPSEEK_MODELE: z.string().min(1).default('deepseek-flash'),
  DEEPSEEK_URL: z.url().default('https://api.deepseek.com'),
  /** Entre 0 et 0,3 ; 0,2 en attendant le jeu de test. */
  DEEPSEEK_TEMPERATURE: z.coerce.number().min(0).max(0.3).default(0.2),
  /**
   * Les tarifs par million de jetons, en millionièmes de l'unité du budget. Par défaut : les prix
   * de pointe de `deepseek-flash` en dollars (0,006 / 0,30 / 1,20), repris tels quels.
   */
  DEEPSEEK_PRIX_ENTREE_CACHE: z.coerce.number().int().min(0).default(6_000),
  DEEPSEEK_PRIX_ENTREE: z.coerce.number().int().min(0).default(300_000),
  DEEPSEEK_PRIX_SORTIE: z.coerce.number().int().min(0).default(1_200_000),
  VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  VAPID_SUJET: z.string().min(1),
  /** Facultative : l'adresse (DSN) d'un Sentry ou d'un GlitchTip. Sans elle, aucune erreur n'est envoyée. */
  SENTRY_DSN: z.preprocess((valeur) => (valeur === '' ? undefined : valeur), z.url().optional()),
  NIVEAU_JOURNAL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
})
export type Config = z.infer<typeof SchemaConfig>

export class ErreurConfig extends Error {
  readonly problemes: readonly string[]
  constructor(problemes: readonly string[]) {
    super(`Configuration invalide :\n${problemes.map((probleme) => `- ${probleme}`).join('\n')}`)
    this.name = 'ErreurConfig'
    this.problemes = problemes
  }
}

/** Lit la configuration ; une variable manquante ou invalide arrête le démarrage avec son nom. */
export function lireConfig(environnement: Readonly<Record<string, string | undefined>>): Config {
  const lecture = SchemaConfig.safeParse(environnement)
  if (lecture.success) return lecture.data
  throw new ErreurConfig(
    lecture.error.issues.map(({ path, message }) => {
      const nom = path.join('.')
      return `${nom} : ${environnement[nom] === undefined ? 'variable manquante' : message}`
    }),
  )
}
