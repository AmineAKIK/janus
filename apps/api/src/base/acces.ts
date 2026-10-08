import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema/index.ts'
import type { Db } from './transaction.ts'

/** Un client au repos que PostgreSQL ferme ne doit pas arrêter le processus : le pool le remplace. */
function ecrireErreurDuPool(erreur: Error): void {
  process.stderr.write(`Connexion PostgreSQL perdue : ${erreur.message}\n`)
}

/** Une connexion Drizzle ; l'API se connecte avec le rôle `janus_app`, jamais avec le propriétaire. */
export function creerAcces(
  urlConnexion: string,
  surErreurDuPool: (erreur: Error) => void = ecrireErreurDuPool,
): { readonly db: Db; readonly pool: pg.Pool } {
  const pool = new pg.Pool({ connectionString: urlConnexion })
  pool.on('error', surErreurDuPool)
  return { db: drizzle(pool, { schema }), pool }
}
