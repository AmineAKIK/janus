import { sql } from 'drizzle-orm'
import {
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

// Le catalogue : importé depuis les fiches. Une version de fiche est figée et jamais modifiée.
// Les identifiants sont des UUID v7 tirés par l'API (`nouvelId`), jamais par la base.

export const formations = pgTable('formations', {
  id: uuid('id').primaryKey(),
  code: text('code').notNull().unique(),
  titre: text('titre').notNull(),
})

export const modules = pgTable(
  'modules',
  {
    id: uuid('id').primaryKey(),
    formationId: uuid('formation_id')
      .notNull()
      .references(() => formations.id),
    code: text('code').notNull(),
    titre: text('titre').notNull(),
    ordre: integer('ordre').notNull(),
  },
  (table) => [unique('modules_formation_code').on(table.formationId, table.code)],
)

export const parties = pgTable(
  'parties',
  {
    id: uuid('id').primaryKey(),
    moduleId: uuid('module_id')
      .notNull()
      .references(() => modules.id),
    code: text('code').notNull(),
    titre: text('titre').notNull(),
    ordre: integer('ordre').notNull(),
  },
  (table) => [unique('parties_module_code').on(table.moduleId, table.code)],
)

export const blocs = pgTable(
  'blocs',
  {
    id: uuid('id').primaryKey(),
    moduleId: uuid('module_id')
      .notNull()
      .references(() => modules.id),
    partieId: uuid('partie_id').references(() => parties.id),
    /** Le code du bloc, par exemple `B02`. */
    code: text('code').notNull(),
    titre: text('titre').notNull(),
    ordre: integer('ordre').notNull(),
  },
  (table) => [
    unique('blocs_module_code').on(table.moduleId, table.code),
    check('blocs_code_format', sql`${table.code} ~ '^[A-Z]{1,3}[0-9]{2,3}$'`),
  ],
)

export const fichesVersions = pgTable(
  'fiches_versions',
  {
    id: uuid('id').primaryKey(),
    blocId: uuid('bloc_id')
      .notNull()
      .references(() => blocs.id),
    version: integer('version').notNull(),
    /** SHA-256 de la fiche, en hexadécimal. */
    empreinte: text('empreinte').notNull(),
    /** Chemin de la fiche HTML. */
    chemin: text('chemin').notNull(),
    manifeste: jsonb('manifeste').notNull(),
    creeLe: timestamp('cree_le', { withTimezone: true, mode: 'string' }).notNull(),
  },
  (table) => [
    unique('fiches_versions_bloc_version').on(table.blocId, table.version),
    uniqueIndex('fiches_versions_bloc_empreinte').on(table.blocId, table.empreinte),
    check('fiches_versions_version_positive', sql`${table.version} >= 1`),
    check('fiches_versions_empreinte_sha256', sql`${table.empreinte} ~ '^[0-9a-f]{64}$'`),
  ],
)

export const cartes = pgTable(
  'cartes',
  {
    id: uuid('id').primaryKey(),
    blocId: uuid('bloc_id')
      .notNull()
      .references(() => blocs.id),
    /** L'identifiant de la carte dans la fiche. */
    carteId: text('carte_id').notNull(),
    recto: text('recto').notNull(),
    verso: text('verso').notNull(),
  },
  (table) => [unique('cartes_bloc_carte').on(table.blocId, table.carteId)],
)

/** Les tâches inédites réservées : seul l'intitulé est gardé, le contenu reste hors de l'appli. */
export const tachesReservees = pgTable('taches_reservees', {
  id: uuid('id').primaryKey(),
  moduleId: uuid('module_id')
    .notNull()
    .references(() => modules.id),
  intitule: text('intitule').notNull(),
})
