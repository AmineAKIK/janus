import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema/index.ts'
import type { Db } from './transaction.ts'

/** Une connexion Drizzle ; l'API se connecte avec le rôle `janus_app`, jamais avec le propriétaire. */
export function creerAcces(urlConnexion: string): { readonly db: Db; readonly pool: pg.Pool } {
  const pool = new pg.Pool({ connectionString: urlConnexion })
  return { db: drizzle(pool, { schema }), pool }
}
