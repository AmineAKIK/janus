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
  VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  VAPID_SUJET: z.string().min(1),
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
