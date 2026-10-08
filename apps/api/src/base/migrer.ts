import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'

const DOSSIER_MIGRATIONS = fileURLToPath(new URL('../../migrations', import.meta.url))

/**
 * Applique les migrations en attente avec le rôle propriétaire. Rejouable : une migration déjà
 * appliquée (suivie dans `drizzle.__drizzle_migrations`) est ignorée.
 */
export async function migrer(urlProprietaire: string): Promise<void> {
  const pool = new pg.Pool({ connectionString: urlProprietaire, max: 1 })
  try {
    await migrate(drizzle(pool), { migrationsFolder: DOSSIER_MIGRATIONS })
  } finally {
    await pool.end()
  }
}
