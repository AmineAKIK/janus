import { sql } from 'drizzle-orm'
import {
  check,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  timestamp,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { blocs } from './catalogue.ts'

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    nomUtilisateur: text('nom_utilisateur').notNull(),
    motDePasseHash: text('mot_de_passe_hash').notNull(),
    /** Les réglages, validés par Zod (`Reglages`) ; les valeurs par défaut sont dans le code. */
    reglages: jsonb('reglages').notNull(),
    reglagesVersion: integer('reglages_version').notNull().default(1),
    creeLe: timestamp('cree_le', { withTimezone: true, mode: 'string' }).notNull(),
  },
  (table) => [
    uniqueIndex('users_nom_utilisateur').on(sql`lower(${table.nomUtilisateur})`),
    check('users_reglages_version_positive', sql`${table.reglagesVersion} >= 1`),
  ],
)

/** L'état qu'une fiche a sauvé ; `version` sert à refuser l'écriture d'un onglet périmé. */
export const etatsPage = pgTable(
  'etats_page',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    blocId: uuid('bloc_id')
      .notNull()
      .references(() => blocs.id),
    etat: jsonb('etat').notNull(),
    version: integer('version').notNull().default(1),
    misAJourLe: timestamp('mis_a_jour_le', { withTimezone: true, mode: 'string' }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.blocId] }),
    check('etats_page_version_positive', sql`${table.version} >= 1`),
  ],
)
