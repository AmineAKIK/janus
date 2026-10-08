import { and, asc, desc, eq, gt, inArray, isNotNull, max } from 'drizzle-orm'
import { instantIso } from '../../base/instant.ts'
import * as t from '../../base/schema/index.ts'
import type { Db, Tx } from '../../base/transaction.ts'

/** Les ordres SQL du suivi : le plan importé, et les mesures que le tableau de bord rassemble. */
export function creerDepotSuivi() {
  return {
    reglagesDe: async (lecteur: Db | Tx, userId: string): Promise<unknown> => {
      const [ligne] = await lecteur
        .select({ reglages: t.users.reglages })
        .from(t.users)
        .where(eq(t.users.id, userId))
      return ligne?.reglages
    },

    /** Les modules importés, dans l'ordre du plan. */
    modulesImportes: (lecteur: Db | Tx) =>
      lecteur
        .select({ id: t.modules.id, code: t.modules.code, titre: t.modules.titre })
        .from(t.modules)
        .where(eq(t.modules.importe, true))
        .orderBy(asc(t.modules.ordre)),

    /** Les blocs des modules importés (ordre du plan), avec leur partie et le manifeste en service. */
    blocsImportes: async (lecteur: Db | Tx) => {
      const lignes = await lecteur
        .select({
          id: t.blocs.id,
          code: t.blocs.code,
          moduleId: t.blocs.moduleId,
          partieCode: t.parties.code,
          partieTitre: t.parties.titre,
          manifeste: t.fichesVersions.manifeste,
        })
        .from(t.blocs)
        .innerJoin(t.modules, eq(t.modules.id, t.blocs.moduleId))
        .leftJoin(t.parties, eq(t.parties.id, t.blocs.partieId))
        .innerJoin(t.fichesVersions, eq(t.fichesVersions.blocId, t.blocs.id))
        .where(eq(t.modules.importe, true))
        .orderBy(
          asc(t.modules.ordre),
          asc(t.parties.ordre),
          asc(t.blocs.ordre),
          desc(t.fichesVersions.version),
        )
      const vus = new Set<string>()
      return lignes.filter(({ id }) => (vus.has(id) ? false : (vus.add(id), true)))
    },

    /** Les idées de « À explorer plus tard », dans l'ordre où elles sont arrivées. */
    idees: (lecteur: Db | Tx, userId: string) =>
      lecteur
        .select({
          id: t.idees.id,
          date: instantIso(t.idees.dateServeur),
          texte: t.idees.texte,
        })
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
    tachesReservees: async (lecteur: Db | Tx) => {
      const lignes = await lecteur
        .select({ intitule: t.tachesReservees.intitule })
        .from(t.tachesReservees)
        .innerJoin(t.modules, eq(t.modules.id, t.tachesReservees.moduleId))
        .where(eq(t.modules.importe, true))
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
        .where(and(eq(t.evenements.userId, userId), eq(t.evenements.type, 'correction.accord')))
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
        .where(and(eq(t.corrections.userId, userId), gt(t.corrections.dateServeur, depuis)))
      const echecs = await lecteur
        .select({
          date: instantIso(t.correctionsEchecs.dateServeur),
          millioniemes: t.correctionsEchecs.coutMillioniemes,
        })
        .from(t.correctionsEchecs)
        .where(
          and(eq(t.correctionsEchecs.userId, userId), gt(t.correctionsEchecs.dateServeur, depuis)),
        )
      return [...gardees, ...echecs]
    },
  }
}
export type DepotSuivi = ReturnType<typeof creerDepotSuivi>
