import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type * as schema from './schema/index.ts'

export type Db = NodePgDatabase<typeof schema>
/** Ce que reçoit le code d'une transaction. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

/** Échec de sérialisation et interblocage : PostgreSQL a annulé la transaction, on la rejoue. */
const CODES_A_REJOUER = new Set(['40001', '40P01'])
export const REJEUX_MAX = 3

/** Le code SQLSTATE d'une erreur PostgreSQL, que Drizzle enveloppe dans `cause`. */
function codePostgres(erreur: unknown): string | undefined {
  let courante: unknown = erreur
  for (let profondeur = 0; profondeur < 5; profondeur += 1) {
    if (typeof courante !== 'object' || courante === null) return undefined
    if ('code' in courante && typeof courante.code === 'string') return courante.code
    courante = 'cause' in courante ? courante.cause : undefined
  }
  return undefined
}

export interface OptionsTransaction {
  readonly db: Db
  /** Appelé à chaque rejeu : numéro du rejeu et code de l'erreur qui l'a causé. */
  readonly surRejeu?: (rejeu: number, code: string) => void
}

/**
 * Le seul point d'ouverture d'une transaction (une règle de lint interdit `db.transaction` ailleurs).
 * `READ COMMITTED`, avec rejeu automatique, jusqu'à 3 fois, sur `40001` et `40P01`.
 */
export function creerTransaction({ db, surRejeu }: OptionsTransaction) {
  return async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    for (let rejeu = 0; ; rejeu += 1) {
      try {
        return await db.transaction(fn, { isolationLevel: 'read committed' })
      } catch (erreur) {
        const code = codePostgres(erreur)
        if (code === undefined || !CODES_A_REJOUER.has(code) || rejeu >= REJEUX_MAX) throw erreur
        surRejeu?.(rejeu + 1, code)
      }
    }
  }
}
export type Transaction = ReturnType<typeof creerTransaction>

/**
 * Verrou consultatif par utilisateur et par bloc, relâché à la fin de la transaction : les
 * recalculs d'un même bloc passent l'un après l'autre, ceux de blocs différents en parallèle.
 */
export async function verrouBloc(tx: Tx, userId: string, blocId: string): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}), hashtext(${blocId}))`)
}
