import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { blocs, fichesVersions } from './catalogue.ts'
import { users } from './utilisateurs.ts'

// Les faits : ajout seul. Le rôle `janus_app` n'a ni UPDATE ni DELETE dessus (migration 0003).
// On n'efface et on ne modifie jamais un fait : on en ajoute un qui le corrige.

const instant = (nom: string) => timestamp(nom, { withTimezone: true, mode: 'string' })
const proprietaire = () => ({
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
})
const duBloc = () => ({
  ...proprietaire(),
  blocId: uuid('bloc_id')
    .notNull()
    .references(() => blocs.id),
})
const SHA256 = (colonne: unknown) => sql`${colonne} ~ '^[0-9a-f]{64}$'`
const parmi = (colonne: unknown, valeurs: readonly string[]) =>
  sql`${colonne} IN (${sql.join(
    valeurs.map((valeur) => sql.raw(`'${valeur}'`)),
    sql`, `,
  )})`

export const evenements = pgTable(
  'evenements',
  {
    /** L'identifiant tiré par la page : unique, un doublon est ignoré (`ON CONFLICT DO NOTHING`). */
    id: uuid('id').primaryKey(),
    ...duBloc(),
    /** La version de fiche qui a produit l'événement : une question renumérotée ne casse pas l'historique. */
    ficheVersionId: uuid('fiche_version_id')
      .notNull()
      .references(() => fichesVersions.id),
    type: text('type').notNull(),
    /** Ce que la page a envoyé, brut : si une règle de statut change, tout se recalcule. */
    donnees: jsonb('donnees').notNull(),
    /** SHA-256 du contenu : le même identifiant avec un autre contenu est refusé (422). */
    empreinte: text('empreinte').notNull(),
    /** Le niveau d'aide (0 à 4) des résultats de pratique et d'atelier. */
    aide: smallint('aide'),
    dateServeur: instant('date_serveur').notNull(),
  },
  (table) => [
    index('evenements_user_bloc_date').on(table.userId, table.blocId, table.dateServeur),
    check('evenements_aide_0_a_4', sql`${table.aide} BETWEEN 0 AND 4`),
    check('evenements_empreinte_sha256', SHA256(table.empreinte)),
  ],
)

export const corrections = pgTable(
  'corrections',
  {
    id: uuid('id').primaryKey(),
    ...duBloc(),
    questionId: text('question_id').notNull(),
    serie: text('serie').notNull(),
    /** Le numéro de l'essai sur une même question d'une même série (1 au premier envoi). */
    tentative: integer('tentative').notNull(),
    tour: integer('tour').notNull(),
    confiance: text('confiance').notNull(),
    reponse: text('reponse').notNull(),
    supportColle: boolean('support_colle').notNull(),
    supportRetourCours: boolean('support_retour_cours').notNull(),
    recopiee: boolean('recopiee').notNull(),
    message: text('message').notNull(),
    niveau: text('niveau').notNull(),
    erreursIds: jsonb('erreurs_ids').notNull(),
    source: text('source').notNull(),
    ref: text('ref').notNull(),
    certitude: text('certitude').notNull(),
    compte: boolean('compte').notNull(),
    raisonNonCompte: text('raison_non_compte'),
    conteste: boolean('conteste').notNull(),
    modele: text('modele').notNull(),
    parametres: jsonb('parametres').notNull(),
    jetonsEntree: integer('jetons_entree').notNull(),
    jetonsSortie: integer('jetons_sortie').notNull(),
    /** En millionièmes d'euro, jamais en nombre à virgule. */
    coutMillioniemes: integer('cout_millioniemes').notNull(),
    /** L'empreinte de la consigne (`prompts/correction/v1.md`) qui a corrigé. */
    consigneEmpreinte: text('consigne_empreinte').notNull(),
    /** Le texte tel que le correcteur l'a rendu, avant toute validation. */
    brut: text('brut').notNull().default(''),
    /** Vrai pour une correction de premier tour tirée au sort : Amine est invité à donner son avis. */
    echantillon: boolean('echantillon').notNull().default(false),
    dateServeur: instant('date_serveur').notNull(),
  },
  (table) => [
    unique('corrections_user_question_serie_tentative_tour').on(
      table.userId,
      table.questionId,
      table.serie,
      table.tentative,
      table.tour,
    ),
    index('corrections_user_question').on(table.userId, table.questionId),
    check('corrections_tentative_positive', sql`${table.tentative} >= 1`),
    check('corrections_tour_positif', sql`${table.tour} >= 1`),
    check(
      'corrections_serie',
      parmi(table.serie, ['restitution', 'consolidation', 'rappel', 'verification']),
    ),
    check('corrections_confiance', parmi(table.confiance, ['sur', 'hesitant', 'hasard'])),
    check(
      'corrections_niveau',
      parmi(table.niveau, ['solide', 'partiel', 'fragile', 'pas_encore']),
    ),
    check('corrections_source', parmi(table.source, ['support', 'deduit', 'ajoute'])),
    check('corrections_certitude', parmi(table.certitude, ['sur', 'non_verifie'])),
    check(
      'corrections_raison_non_compte',
      sql`(${table.compte} AND ${table.raisonNonCompte} IS NULL) OR (NOT ${table.compte} AND ${table.raisonNonCompte} IS NOT NULL AND ${table.raisonNonCompte} IN ('relance', 'avec_support', 'recopiee', 'non_verifiee'))`,
    ),
    check(
      'corrections_jetons_et_cout',
      sql`${table.jetonsEntree} >= 0 AND ${table.jetonsSortie} >= 0 AND ${table.coutMillioniemes} >= 0`,
    ),
    check('corrections_consigne_sha256', SHA256(table.consigneEmpreinte)),
  ],
)

/**
 * Un appel au correcteur qui n'a rien donné de valide, même au second essai : la réponse brute est
 * gardée pour comprendre, et le coût déjà payé reste compté.
 */
export const correctionsEchecs = pgTable('corrections_echecs', {
  id: uuid('id').primaryKey(),
  ...duBloc(),
  questionId: text('question_id').notNull(),
  serie: text('serie').notNull(),
  tentative: integer('tentative').notNull(),
  tour: integer('tour').notNull(),
  /** Pourquoi la réponse a été refusée. */
  motif: text('motif').notNull(),
  /** Les textes reçus, un par essai. */
  bruts: jsonb('bruts').notNull(),
  modele: text('modele').notNull(),
  coutMillioniemes: integer('cout_millioniemes').notNull(),
  dateServeur: instant('date_serveur').notNull(),
})

/** « Forcer » un statut ou lever le forçage : une ligne par décision d'Amine. */
export const statutsForces = pgTable(
  'statuts_forces',
  {
    id: uuid('id').primaryKey(),
    ...duBloc(),
    action: text('action').notNull(),
    statut: text('statut'),
    raison: text('raison'),
    dateServeur: instant('date_serveur').notNull(),
  },
  (table) => [
    check('statuts_forces_action', parmi(table.action, ['forcer', 'lever'])),
    check(
      'statuts_forces_forcer_a_statut_et_raison',
      sql`(${table.action} = 'forcer' AND ${table.statut} IS NOT NULL AND length(trim(${table.raison})) > 0) OR (${table.action} = 'lever' AND ${table.statut} IS NULL AND ${table.raison} IS NULL)`,
    ),
    check(
      'statuts_forces_statut',
      sql`${table.statut} IS NULL OR ${table.statut} IN ('non_commence', 'en_cours', 'vu', 'acquis_provisoirement', 'acquis', 'maitrise', 'a_reprendre')`,
    ),
  ],
)

/** Les erreurs critiques cochées, décochées, ou confirmées/rejetées quand l'IA les propose. */
export const decisionsErreurs = pgTable(
  'decisions_erreurs',
  {
    id: uuid('id').primaryKey(),
    ...duBloc(),
    erreurId: text('erreur_id').notNull(),
    decision: text('decision').notNull(),
    /** Pour cochée et décochée : par Amine, ou à la suite d'une proposition de l'IA. */
    source: text('source'),
    /** Pour confirmée et rejetée : la correction où l'IA a repéré l'erreur. */
    correctionId: uuid('correction_id').references(() => corrections.id),
    dateServeur: instant('date_serveur').notNull(),
  },
  (table) => [
    index('decisions_erreurs_user_bloc').on(table.userId, table.blocId, table.dateServeur),
    check(
      'decisions_erreurs_decision',
      parmi(table.decision, ['cochee', 'decochee', 'confirmee', 'rejetee']),
    ),
    check(
      'decisions_erreurs_forme',
      sql`(${table.decision} IN ('cochee', 'decochee') AND ${table.source} IS NOT NULL AND ${table.source} IN ('amine', 'ia_confirmee') AND ${table.correctionId} IS NULL) OR (${table.decision} IN ('confirmee', 'rejetee') AND ${table.source} IS NULL AND ${table.correctionId} IS NOT NULL)`,
    ),
  ],
)

/**
 * Les notes d'Amine sur le journal. Une modification ajoute une ligne avec le même `note_id` :
 * la note courante est la plus récente.
 */
export const notesJournal = pgTable(
  'notes_journal',
  {
    id: uuid('id').primaryKey(),
    noteId: uuid('note_id').notNull(),
    ...proprietaire(),
    /** L'identifiant de la ligne du journal annotée. */
    entree: text('entree').notNull(),
    texte: text('texte').notNull(),
    dateServeur: instant('date_serveur').notNull(),
  },
  (table) => [
    index('notes_journal_user_note').on(table.userId, table.noteId, table.dateServeur),
    check('notes_journal_texte', sql`length(trim(${table.texte})) BETWEEN 1 AND 1000`),
  ],
)

export const idees = pgTable(
  'idees',
  {
    id: uuid('id').primaryKey(),
    ...proprietaire(),
    texte: text('texte').notNull(),
    dateServeur: instant('date_serveur').notNull(),
  },
  (table) => [check('idees_texte', sql`length(trim(${table.texte})) BETWEEN 1 AND 10000`)],
)

export const revuesMethode = pgTable(
  'revues_methode',
  {
    id: uuid('id').primaryKey(),
    ...proprietaire(),
    texte: text('texte'),
    dateServeur: instant('date_serveur').notNull(),
  },
  (table) => [
    check(
      'revues_methode_texte',
      sql`${table.texte} IS NULL OR length(trim(${table.texte})) BETWEEN 1 AND 10000`,
    ),
  ],
)

/** Les questions et tâches tirées pour une vérification : de quoi la rendre à l'identique si on la rouvre. */
export const verificationsTirees = pgTable(
  'verifications_tirees',
  {
    id: uuid('id').primaryKey(),
    ...duBloc(),
    type: text('type').notNull(),
    tirage: jsonb('tirage').notNull(),
    dateServeur: instant('date_serveur').notNull(),
  },
  (table) => [
    check('verifications_tirees_type', parmi(table.type, ['verification', 'retest', 'entretien'])),
  ],
)

/** Les questions tirées pour la série de début de séance d'un jour. */
export const seriesQuestionsDebut = pgTable(
  'series_questions_debut',
  {
    id: uuid('id').primaryKey(),
    ...proprietaire(),
    /** Le jour (avec la bascule), calculé par le moteur. */
    jour: date('jour', { mode: 'string' }).notNull(),
    questions: jsonb('questions').notNull(),
    dateServeur: instant('date_serveur').notNull(),
  },
  (table) => [unique('series_questions_debut_user_jour').on(table.userId, table.jour)],
)

/** Une session ouverte ; seule l'empreinte du jeton est gardée, jamais le jeton. */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey(),
    ...proprietaire(),
    empreinteJeton: text('empreinte_jeton').notNull().unique(),
    creeLe: instant('cree_le').notNull(),
    expireLe: instant('expire_le').notNull(),
    appareil: text('appareil'),
    /** « Rester connecté » : sinon la session expire après 12 h sans activité. */
    persistante: boolean('persistante').notNull().default(false),
  },
  (table) => [
    index('sessions_user').on(table.userId),
    check('sessions_empreinte_sha256', SHA256(table.empreinteJeton)),
    check('sessions_expire_apres_creation', sql`${table.expireLe} > ${table.creeLe}`),
  ],
)

/** Révoquer une session ajoute une ligne : la table des sessions reste en ajout seul. */
export const sessionsRevoquees = pgTable('sessions_revoquees', {
  sessionId: uuid('session_id')
    .primaryKey()
    .references(() => sessions.id),
  revoqueeLe: instant('revoquee_le').notNull(),
})

/** La dernière activité d'une session : la seule chose qui change, donc hors de `sessions` (ajout seul). */
export const sessionsActivite = pgTable('sessions_activite', {
  sessionId: uuid('session_id')
    .primaryKey()
    .references(() => sessions.id),
  derniereActivite: instant('derniere_activite').notNull(),
})

/** Un rappel par jour au plus : la ligne est insérée avant l'envoi. */
export const rappelsEnvoyes = pgTable(
  'rappels_envoyes',
  {
    id: uuid('id').primaryKey(),
    ...proprietaire(),
    jour: date('jour', { mode: 'string' }).notNull(),
    envoyeLe: instant('envoye_le').notNull(),
  },
  (table) => [unique('rappels_envoyes_user_jour').on(table.userId, table.jour)],
)

/** Les tables de faits, que le rôle de l'appli ne peut ni modifier ni effacer. */
export const TABLES_DE_FAITS = [
  'evenements',
  'corrections',
  'corrections_echecs',
  'statuts_forces',
  'decisions_erreurs',
  'notes_journal',
  'idees',
  'revues_methode',
  'verifications_tirees',
  'series_questions_debut',
  'sessions',
  'sessions_revoquees',
  'rappels_envoyes',
] as const
