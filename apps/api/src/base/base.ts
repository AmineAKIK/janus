import type pg from 'pg'
import { creerAcces } from './acces.ts'
import { creerTransaction } from './transaction.ts'
import type { Db } from './transaction.ts'

/** Ce que l'API demande à PostgreSQL : des requêtes Drizzle, des transactions, un test de vie. */
export interface Base {
  readonly db: Db
  /** Le seul point d'ouverture d'une transaction : `READ COMMITTED`, avec rejeu. */
  readonly enTransaction: ReturnType<typeof creerTransaction>
  readonly requete: (texte: string) => Promise<unknown>
  readonly fermer: () => Promise<void>
}

export function baseDepuisPool(db: Db, pool: pg.Pool): Base {
  return {
    db,
    enTransaction: creerTransaction({ db }),
    requete: (texte) => pool.query(texte),
    fermer: () => pool.end(),
  }
}

export function creerBase(urlConnexion: string): Base {
  const { db, pool } = creerAcces(urlConnexion)
  return baseDepuisPool(db, pool)
}
