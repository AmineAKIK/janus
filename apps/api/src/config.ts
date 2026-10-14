import { z } from 'zod'

const Booleen = z.enum(['true', 'false']).transform((valeur) => valeur === 'true')

/** Une clé facultative : vide (la CI passe un secret absent comme une chaîne vide) vaut absente. */
const CleFacultative = z.preprocess(
  (valeur) => (valeur === '' ? undefined : valeur),
  z.string().min(1).optional(),
)

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
  /** Où les fiches importées sont rangées (le volume partagé avec le front). */
  FICHES_DIR: z.string().min(1).default('/fiches'),
  COOKIE_SECURE: Booleen,
  /** Le port d'écoute de l'API. */
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  /** Le fournisseur de la correction. Sans la clé qui va avec, la correction par l'IA est indisponible. */
  CORRECTEUR: z.enum(['deepseek', 'claude']).default('deepseek'),
  /** Facultative (vide ou absente) : sans elle, la correction par DeepSeek est indisponible. */
  DEEPSEEK_API_KEY: CleFacultative,
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
  /** Facultative (vide ou absente) : sans elle, la correction par Claude est indisponible. */
  ANTHROPIC_API_KEY: CleFacultative,
  /** Le modèle Claude de correction : Haiku 5.5, le moins cher, réflexion désactivée. */
  CLAUDE_MODELE: z.string().min(1).default('claude-haiku-5-5'),
  CLAUDE_URL: z.url().default('https://api.anthropic.com'),
  /**
   * Les tarifs de `claude-haiku-5-5` en dollars par million de jetons, en millionièmes, pour une
   * demande de 100 000 jetons au plus (0,01 lecture du cache / 0,10 / 0,50).
   */
  CLAUDE_PRIX_ENTREE_CACHE: z.coerce.number().int().min(0).default(10_000),
  CLAUDE_PRIX_ENTREE: z.coerce.number().int().min(0).default(100_000),
  CLAUDE_PRIX_SORTIE: z.coerce.number().int().min(0).default(500_000),
  VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  VAPID_SUJET: z.string().min(1),
  /** Facultative : l'adresse (DSN) d'un Sentry ou d'un GlitchTip. Sans elle, aucune erreur n'est envoyée. */
  SENTRY_DSN: z.preprocess((valeur) => (valeur === '' ? undefined : valeur), z.url().optional()),
  /** Demandes de correction par minute et par adresse (le plafond horaire en base borne le coût). */
  CORRECTIONS_PAR_MINUTE: z.coerce.number().int().positive().default(20),
  /** Connexions par minute et par adresse, tous noms confondus : borne le hachage d'un flot de faux noms. */
  CONNEXIONS_PAR_ADRESSE_PAR_MINUTE: z.coerce.number().int().positive().default(20),
  NIVEAU_JOURNAL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
})
export type Config = z.infer<typeof SchemaConfig>

/** Ce que lit le choix du correcteur : le fournisseur, ses clés, ses modèles et ses tarifs. */
export const SchemaConfigCorrecteur = SchemaConfig.pick({
  CORRECTEUR: true,
  DEEPSEEK_API_KEY: true,
  DEEPSEEK_MODELE: true,
  DEEPSEEK_URL: true,
  DEEPSEEK_TEMPERATURE: true,
  DEEPSEEK_PRIX_ENTREE_CACHE: true,
  DEEPSEEK_PRIX_ENTREE: true,
  DEEPSEEK_PRIX_SORTIE: true,
  ANTHROPIC_API_KEY: true,
  CLAUDE_MODELE: true,
  CLAUDE_URL: true,
  CLAUDE_PRIX_ENTREE_CACHE: true,
  CLAUDE_PRIX_ENTREE: true,
  CLAUDE_PRIX_SORTIE: true,
})
export type ConfigCorrecteur = z.infer<typeof SchemaConfigCorrecteur>

/** Ce que lit la commande d'import des fiches : la base et le dossier où elles sont servies. */
export const SchemaImport = z.object({
  DATABASE_URL: z.string().min(1),
  FICHES_DIR: z.string().min(1),
})

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
