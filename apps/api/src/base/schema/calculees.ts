import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { blocs, cartes } from './catalogue.ts'
import { users } from './utilisateurs.ts'

// Les tables calculées se reconstruisent depuis les faits : on peut les vider et les recalculer.
// Chaque ligne garde la `version_moteur` qui l'a produite ; au démarrage, une ligne dont la version
// diffère de celle du moteur est recalculée.

const instant = (nom: string) => timestamp(nom, { withTimezone: true, mode: 'string' })
const proprietaire = () =>
  uuid('user_id')
    .notNull()
    .references(() => users.id)
const versionMoteur = () => integer('version_moteur').notNull()

export const statutsCourants = pgTable(
  'statuts_courants',
  {
    userId: proprietaire(),
    blocId: uuid('bloc_id')
      .notNull()
      .references(() => blocs.id),
    statutCalcule: text('statut_calcule').notNull(),
    detail: jsonb('detail').notNull(),
    versionMoteur: versionMoteur(),
    calculeLe: instant('calcule_le').notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.blocId] })],
)

export const echeances = pgTable(
  'echeances',
  {
    id: uuid('id').primaryKey(),
    userId: proprietaire(),
    blocId: uuid('bloc_id')
      .notNull()
      .references(() => blocs.id),
    /** Ce qui est dû : `consolidation`, `verification`, `retest` ou `entretien`. */
    type: text('type').notNull(),
    /** `instant` (consolidation) ou `jour` : comment le moteur l'a calculée. */
    genre: text('genre').notNull(),
    dueLe: instant('due_le').notNull(),
    faiteLe: instant('faite_le'),
    versionMoteur: versionMoteur(),
  },
  (table) => [
    index('echeances_a_faire')
      .on(table.userId, table.dueLe)
      .where(sql`${table.faiteLe} IS NULL`),
  ],
)

export const revuesFsrs = pgTable(
  'revues_fsrs',
  {
    id: uuid('id').primaryKey(),
    userId: proprietaire(),
    carteId: uuid('carte_id')
      .notNull()
      .references(() => cartes.id),
    dueLe: instant('due_le').notNull(),
    etat: jsonb('etat').notNull(),
    versionMoteur: versionMoteur(),
  },
  (table) => [
    unique('revues_fsrs_user_carte').on(table.userId, table.carteId),
    index('revues_fsrs_due').on(table.userId, table.dueLe),
  ],
)

export const journal = pgTable(
  'journal',
  {
    id: uuid('id').primaryKey(),
    userId: proprietaire(),
    blocId: uuid('bloc_id').references(() => blocs.id),
    type: text('type').notNull(),
    donnees: jsonb('donnees').notNull(),
    versionMoteur: versionMoteur(),
    dateServeur: instant('date_serveur').notNull(),
  },
  (table) => [index('journal_user_date').on(table.userId, table.dateServeur)],
)

/** Le budget IA d'un mois (`AAAA-MM`), en millionièmes d'euro. `reserve` : le coût annoncé d'appels en cours. */
export const budgetIa = pgTable(
  'budget_ia',
  {
    userId: proprietaire(),
    mois: text('mois').notNull(),
    plafondMillioniemes: integer('plafond_millioniemes').notNull(),
    consommeMillioniemes: integer('consomme_millioniemes').notNull(),
    reserveMillioniemes: integer('reserve_millioniemes').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.mois] }),
    check('budget_ia_mois', sql`${table.mois} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
    check(
      'budget_ia_montants',
      sql`${table.plafondMillioniemes} >= 0 AND ${table.consommeMillioniemes} >= 0 AND ${table.reserveMillioniemes} >= 0`,
    ),
    check(
      'budget_ia_plafond',
      sql`${table.consommeMillioniemes} + ${table.reserveMillioniemes} <= ${table.plafondMillioniemes}`,
    ),
  ],
)

export const abonnementsPush = pgTable(
  'abonnements_push',
  {
    id: uuid('id').primaryKey(),
    userId: proprietaire(),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    creeLe: instant('cree_le').notNull(),
  },
  (table) => [unique('abonnements_push_endpoint').on(table.endpoint)],
)

export const TABLES_CALCULEES = [
  'statuts_courants',
  'echeances',
  'revues_fsrs',
  'journal',
  'budget_ia',
  'abonnements_push',
] as const
