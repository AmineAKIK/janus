import type { Config } from './config.ts'
import type { Base } from './base/base.ts'
import type { Horloge } from './horloge.ts'

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
  /** Appelé par chaque middleware quand il passe sur une requête : sert aux tests d'ordre. */
  readonly observer?: (nom: NomMiddleware) => void
}

/** La session : toujours vide jusqu'à la connexion (PR-082). */
export interface Session {
  readonly utilisateur: string | null
}

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
