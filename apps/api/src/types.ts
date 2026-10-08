import type { Config } from './config.ts'
import type { Base } from './base/base.ts'
import type { Correcteur } from './adaptateurs/correcteur/correcteur.ts'
import type { Horloge } from './horloge.ts'
import type { CorrectionRecue, ROUTES, SortieRoute } from '@janus/contrats'

/** Les noms des middlewares, dans l'ordre exact de la chaîne (`plugins/ordre.ts`). */
export const NOMS_MIDDLEWARES = [
  'identifiant_requete',
  'limites',
  'helmet',
  'cors',
  'limite_debit',
  'session',
  'origine',
  'authentification',
  'validation',
  'identifiant_ecriture',
  'gestionnaire_erreurs',
  'etag',
  'journal_fin',
] as const
export type NomMiddleware = (typeof NOMS_MIDDLEWARES)[number]

/** Ce que l'API reçoit de l'extérieur : jamais lu dans un global, toujours injecté. */
export interface Dependances {
  readonly config: Config
  readonly horloge: Horloge
  readonly base: Base
  /** La connexion du rôle propriétaire : seule la suppression d'un compte s'en sert. */
  readonly proprietaire: Base
  /** Le correcteur : absent, la clé DeepSeek de la configuration en crée un, sans elle la correction est indisponible. */
  readonly correcteur?: Correcteur
  /** Un nombre dans [0, 1[ : le tirage de l'échantillon de contrôle (`Math.random` en production). */
  readonly hasard?: () => number
  /** Appelé par chaque middleware quand il passe sur une requête : sert aux tests d'ordre. */
  readonly observer?: (nom: NomMiddleware) => void
}

/** La session de la requête : vide tant que le cookie ne désigne pas une session valide. */
export interface Session {
  readonly utilisateur: string | null
  readonly sessionId: string | null
}

/** Lit le jeton du cookie et rend la session qu'il désigne (vide si elle est inconnue, révoquée ou expirée). */
export type ResoudreSession = (jeton: string | undefined) => Promise<Session>

declare module 'fastify' {
  interface FastifyRequest {
    session: Session
    /** Le chrono au début de la requête, pour la durée du journal de fin. */
    debutChrono: number
  }
  interface FastifyContextConfig {
    /** Vraie pour une route que l'on peut appeler sans être connecté (connexion, santé). */
    publique?: boolean
    /**
     * Toute écriture déclare si son corps porte l'identifiant que le client a tiré (`id`, UUID) :
     * une route d'écriture sans cette déclaration ne démarre pas.
     */
    identifiant?: boolean
  }
}

/** La correction d'une partie de vérification (explication, transfert), fournie par le domaine de correction. */
export type CorrigerPartie = (
  userId: string,
  demande: {
    readonly id: string
    readonly verification: string
    readonly question: string
    readonly reponse: string
    readonly confiance: 'sur' | 'hesitant' | 'hasard'
    readonly support: { readonly colle: boolean; readonly retour_cours: boolean }
  },
) => Promise<CorrectionRecue>

/** L'écran Aujourd'hui, fourni par le domaine des révisions : le tableau de bord en reprend les tâches. */
export type LireAujourdhui = (
  userId: string,
) => Promise<SortieRoute<(typeof ROUTES)['GET /aujourdhui']>>
