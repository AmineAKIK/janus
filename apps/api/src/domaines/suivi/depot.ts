import { and, asc, desc, eq, inArray, isNotNull, max } from 'drizzle-orm'
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core'
import { instantIso } from '../../base/instant.ts'
import {
  ajouterSiAbsent,
  appelsDuCorrecteurDepuis,
  avisDAmine,
  moduleImporte,
  reglagesDe,
  uneParBloc,
} from '../../base/requetes.ts'
import * as t from '../../base/schema/index.ts'
import type { Db, Tx } from '../../base/transaction.ts'

const colonnesIdee = {
  id: t.idees.id,
  date: instantIso(t.idees.dateServeur),
  texte: t.idees.texte,
}

/** Les tables dont chaque ligne appartient à l'utilisateur, sous le nom qu'elles prennent dans l'export. */
const TABLES_DE_L_EXPORT: Readonly<Record<string, PgTable & { readonly userId: AnyPgColumn }>> = {
  evenements: t.evenements,
  corrections: t.corrections,
  corrections_echecs: t.correctionsEchecs,
  statuts_forces: t.statutsForces,
  decisions_erreurs: t.decisionsErreurs,
  notes_journal: t.notesJournal,
  idees: t.idees,
  revues_methode: t.revuesMethode,
  notes_cartes: t.notesCartes,
  verifications_tirees: t.verificationsTirees,
  series_questions_debut: t.seriesQuestionsDebut,
  rappels_envoyes: t.rappelsEnvoyes,
  statuts_courants: t.statutsCourants,
  echeances: t.echeances,
  revues_fsrs: t.revuesFsrs,
  pauses_formation: t.pausesFormation,
  budget_ia: t.budgetIa,
  etats_page: t.etatsPage,
}

/** Les ordres SQL du suivi : le plan importé, et les mesures que le tableau de bord rassemble. */
export function creerDepotSuivi() {
  return {
    reglagesDe,

    /**
     * Tout ce qui appartient à l'utilisateur, table par table. Ni le hash du mot de passe, ni les
     * sessions, ni les abonnements push (des secrets) n'en font partie.
     */
    donneesDe: async (lecteur: Db | Tx, userId: string): Promise<Record<string, unknown[]>> => {
      const [compte] = await lecteur
        .select({
          id: t.users.id,
          nom_utilisateur: t.users.nomUtilisateur,
          reglages: t.users.reglages,
          reglages_version: t.users.reglagesVersion,
          cree_le: t.users.creeLe,
        })
        .from(t.users)
        .where(eq(t.users.id, userId))
      const donnees: Record<string, unknown[]> = { users: compte === undefined ? [] : [compte] }
      for (const [nom, table] of Object.entries(TABLES_DE_L_EXPORT)) {
        donnees[nom] = await lecteur.select().from(table).where(eq(table.userId, userId))
      }
      return donnees
    },

    /** Les modules importés, dans l'ordre du plan. */
    modulesImportes: (lecteur: Db | Tx, formationId: string | null) =>
      lecteur
        .select({ id: t.modules.id, code: t.modules.code, titre: t.modules.titre })
        .from(t.modules)
        .where(moduleImporte(formationId))
        .orderBy(asc(t.modules.ordre)),

    /** Les blocs des modules importés (ordre du plan), avec leur partie et le manifeste en service. */
    blocsImportes: async (lecteur: Db | Tx, formationId: string | null) => {
      const lignes = await lecteur
        .select({
          id: t.blocs.id,
          code: t.blocs.code,
          moduleId: t.blocs.moduleId,
          partieCode: t.parties.code,
          partieTitre: t.parties.titre,
          manifeste: t.fichesVersions.manifeste,
          versionId: t.fichesVersions.id,
        })
        .from(t.blocs)
        .innerJoin(t.modules, eq(t.modules.id, t.blocs.moduleId))
        .leftJoin(t.parties, eq(t.parties.id, t.blocs.partieId))
        .innerJoin(t.fichesVersions, eq(t.fichesVersions.blocId, t.blocs.id))
        .where(moduleImporte(formationId))
        .orderBy(
          asc(t.modules.ordre),
          asc(t.parties.ordre),
          asc(t.blocs.ordre),
          desc(t.fichesVersions.version),
        )
      return uneParBloc(lignes)
    },

    /** Les idées de « À explorer plus tard », dans l'ordre où elles sont arrivées. */
    idees: (lecteur: Db | Tx, userId: string) =>
      lecteur
        .select(colonnesIdee)
        .from(t.idees)
        .where(eq(t.idees.userId, userId))
        .orderBy(asc(t.idees.dateServeur), asc(t.idees.id)),

    /** Toutes les versions des notes du journal, de la plus ancienne à la plus récente. */
    versionsDesNotes: (lecteur: Db | Tx, userId: string) =>
      lecteur
        .select({
          noteId: t.notesJournal.noteId,
          entree: t.notesJournal.entree,
          texte: t.notesJournal.texte,
          date: instantIso(t.notesJournal.dateServeur),
        })
        .from(t.notesJournal)
        .where(eq(t.notesJournal.userId, userId))
        .orderBy(asc(t.notesJournal.dateServeur), asc(t.notesJournal.id)),

    /** Les versions d'une note, de la plus ancienne à la plus récente. */
    versionsDeLaNote: (lecteur: Db | Tx, userId: string, noteId: string) =>
      lecteur
        .select({
          entree: t.notesJournal.entree,
          texte: t.notesJournal.texte,
          date: instantIso(t.notesJournal.dateServeur),
        })
        .from(t.notesJournal)
        .where(and(eq(t.notesJournal.userId, userId), eq(t.notesJournal.noteId, noteId)))
        .orderBy(asc(t.notesJournal.dateServeur), asc(t.notesJournal.id)),

    /** Le `note_id` de la note qui annote déjà cette ligne, s'il y en a une. */
    noteDeLEntree: async (lecteur: Db | Tx, userId: string, entree: string) => {
      const [ligne] = await lecteur
        .select({ noteId: t.notesJournal.noteId })
        .from(t.notesJournal)
        .where(and(eq(t.notesJournal.userId, userId), eq(t.notesJournal.entree, entree)))
        .limit(1)
      return ligne?.noteId
    },

    ajouterVersionDeNote: async (
      tx: Tx,
      o: {
        id: string
        noteId: string
        userId: string
        entree: string
        texte: string
        dateServeur: string
      },
    ): Promise<void> => {
      await tx.insert(t.notesJournal).values(o)
    },

    /** Ajoute une idée ; `false` si cet identifiant était déjà là. */
    ajouterIdee: (
      tx: Tx,
      o: { id: string; userId: string; texte: string; dateServeur: string },
    ): Promise<boolean> => ajouterSiAbsent(tx, t.idees, o),

    ideeParId: async (lecteur: Db | Tx, userId: string, id: string) => {
      const [ligne] = await lecteur
        .select(colonnesIdee)
        .from(t.idees)
        .where(and(eq(t.idees.id, id), eq(t.idees.userId, userId)))
      return ligne
    },

    /** Rend faux si l'identifiant existait déjà. */
    ajouterRevueDeLaMethode: (
      tx: Tx,
      o: { id: string; userId: string; texte: string | null; dateServeur: string },
    ): Promise<boolean> => ajouterSiAbsent(tx, t.revuesMethode, o),

    revueParId: async (lecteur: Db | Tx, id: string) => {
      const [ligne] = await lecteur
        .select({ userId: t.revuesMethode.userId, texte: t.revuesMethode.texte })
        .from(t.revuesMethode)
        .where(eq(t.revuesMethode.id, id))
      return ligne
    },

    /** Le texte de la dernière revue de la méthode qui en a un. */
    dernierTexteDeRevue: async (lecteur: Db | Tx, userId: string) => {
      const [ligne] = await lecteur
        .select({ texte: t.revuesMethode.texte })
        .from(t.revuesMethode)
        .where(and(eq(t.revuesMethode.userId, userId), isNotNull(t.revuesMethode.texte)))
        .orderBy(desc(t.revuesMethode.dateServeur), desc(t.revuesMethode.id))
        .limit(1)
      return ligne?.texte ?? null
    },

    /** Les intitulés des tâches inédites réservées des modules importés. */
    tachesReservees: async (lecteur: Db | Tx, formationId: string | null) => {
      const lignes = await lecteur
        .select({ intitule: t.tachesReservees.intitule })
        .from(t.tachesReservees)
        .innerJoin(t.modules, eq(t.modules.id, t.tachesReservees.moduleId))
        .where(and(moduleImporte(formationId), eq(t.tachesReservees.active, true)))
        .orderBy(asc(t.modules.ordre), asc(t.tachesReservees.id))
      return lignes.map(({ intitule }) => intitule)
    },

    /** Chaque correction rendue : mise à l'avis ou non, vérifiée ou non (l'avis se lit à part). */
    correctionsRendues: (lecteur: Db | Tx, userId: string) =>
      lecteur
        .select({
          id: t.corrections.id,
          date: instantIso(t.corrections.dateServeur),
          echantillon: t.corrections.echantillon,
          certitude: t.corrections.certitude,
        })
        .from(t.corrections)
        .where(eq(t.corrections.userId, userId)),

    /** Les avis d'Amine sur les corrections de l'échantillon, du plus ancien au plus récent. */
    avisSurCorrections: (lecteur: Db | Tx, userId: string) =>
      lecteur
        .select({ donnees: t.evenements.donnees })
        .from(t.evenements)
        .where(avisDAmine(userId))
        .orderBy(asc(t.evenements.dateServeur), asc(t.evenements.id)),

    notesDeCartes: (lecteur: Db | Tx, userId: string) =>
      lecteur
        .select({ date: instantIso(t.notesCartes.dateServeur), note: t.notesCartes.note })
        .from(t.notesCartes)
        .where(eq(t.notesCartes.userId, userId))
        .orderBy(asc(t.notesCartes.dateServeur)),

    /** Le temps actif reçu, minute par minute. */
    tempsActif: (lecteur: Db | Tx, userId: string, blocIds: readonly string[]) =>
      blocIds.length === 0
        ? Promise.resolve([])
        : lecteur
            .select({
              blocId: t.evenements.blocId,
              date: instantIso(t.evenements.dateServeur),
              donnees: t.evenements.donnees,
            })
            .from(t.evenements)
            .where(
              and(
                eq(t.evenements.userId, userId),
                eq(t.evenements.type, 'temps.actif'),
                inArray(t.evenements.blocId, [...blocIds]),
              ),
            ),

    derniereRevueDeLaMethode: async (lecteur: Db | Tx, userId: string) => {
      const [ligne] = await lecteur
        .select({ date: max(instantIso(t.revuesMethode.dateServeur)) })
        .from(t.revuesMethode)
        .where(eq(t.revuesMethode.userId, userId))
      return ligne?.date ?? null
    },

    /** Ce que chaque appel au correcteur a coûté depuis cet instant (corrections gardées et échecs). */
    coutsDepuis: async (lecteur: Db | Tx, userId: string, depuis: string) => {
      const gardees = await lecteur
        .select({
          date: instantIso(t.corrections.dateServeur),
          millioniemes: t.corrections.coutMillioniemes,
        })
        .from(t.corrections)
        .where(appelsDuCorrecteurDepuis(t.corrections, userId, depuis))
      const echecs = await lecteur
        .select({
          date: instantIso(t.correctionsEchecs.dateServeur),
          millioniemes: t.correctionsEchecs.coutMillioniemes,
        })
        .from(t.correctionsEchecs)
        .where(appelsDuCorrecteurDepuis(t.correctionsEchecs, userId, depuis))
      return [...gardees, ...echecs]
    },
  }
}
export type DepotSuivi = ReturnType<typeof creerDepotSuivi>
