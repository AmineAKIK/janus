import { sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

/** Lit une colonne `timestamptz` comme un instant ISO 8601 UTC (`2026-10-01T10:00:00.000Z`), sans `Date`. */
export function instantIso(colonne: AnyPgColumn) {
  return sql<string>`to_char(${colonne} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`
}
