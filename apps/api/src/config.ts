import { z } from 'zod'

const Booleen = z.enum(['true', 'false']).transform((valeur) => valeur === 'true')

/** Les variables d'environnement de l'API, lues et validées une seule fois au démarrage. */
export const SchemaConfig = z.object({
  DATABASE_URL: z.string().min(1),
  /** L'origine exacte de l'appli (`https://exemple.fr`), la seule autorisée à écrire. */
  ORIGINE_APPLI: z.url(),
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
  constructor(readonly problemes: readonly string[]) {
    super(`Configuration invalide :\n${problemes.map((probleme) => `- ${probleme}`).join('\n')}`)
    this.name = 'ErreurConfig'
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
