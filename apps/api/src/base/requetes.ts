import { and, desc, eq, gt, inArray } from 'drizzle-orm'
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core'
import { deLaFormation } from './formationActive.ts'
import * as t from './schema/index.ts'
import type { Db, Tx } from './transaction.ts'

// Les fragments de requête que plusieurs dépôts posent à l'identique. Chaque dépôt garde ses
// projections et ses tris : ici vivent seulement les conditions, les jointures et les motifs
// d'écriture qui ne changent que si le schéma change.

/** Les réglages d'un utilisateur tels que stockés (à passer par `Reglages.parse`) ; `undefined` s'il n'existe pas. */
export async function reglagesDe(lecteur: Db | Tx, userId: string): Promise<unknown> {
  const [ligne] = await lecteur
    .select({ reglages: t.users.reglages })
    .from(t.users)
    .where(eq(t.users.id, userId))
  return ligne?.reglages
}

export async function formationExiste(lecteur: Db | Tx, id: string): Promise<boolean> {
  const lignes = await lecteur
    .select({ id: t.formations.id })
    .from(t.formations)
    .where(eq(t.formations.id, id))
  return lignes.length > 0
}

/** Un module importé, dans la formation affichée (toutes si aucune n'est choisie). */
export const moduleImporte = (formationId: string | null) =>
  and(eq(t.modules.importe, true), deLaFormation(formationId))

/**
 * Garde la première ligne de chaque bloc. Les requêtes qui joignent `fiches_versions` rendent une
 * ligne par version, la plus récente d'abord : il reste la version en service.
 */
export function uneParBloc<T extends { readonly id: string }>(lignes: readonly T[]): T[] {
  const vus = new Set<string>()
  return lignes.filter(({ id }) => (vus.has(id) ? false : (vus.add(id), true)))
}

/** Les lignes d'un utilisateur sur ces blocs. */
export const deLUtilisateurSurLesBlocs = (
  table: { readonly userId: AnyPgColumn; readonly blocId: AnyPgColumn },
  userId: string,
  blocIds: readonly string[],
) => and(eq(table.userId, userId), inArray(table.blocId, [...blocIds]))

/** Les avis qu'Amine a donnés sur les corrections de l'IA (événements `correction.accord`). */
export const avisDAmine = (userId: string) =>
  and(eq(t.evenements.userId, userId), eq(t.evenements.type, 'correction.accord'))

/** Les appels au correcteur d'un utilisateur depuis un instant : les corrections gardées comme les échecs. */
export const appelsDuCorrecteurDepuis = (
  table: typeof t.corrections | typeof t.correctionsEchecs,
  userId: string,
  depuis: string,
) => and(eq(table.userId, userId), gt(table.dateServeur, depuis))

/** Le bloc de ce code. Le code est unique dans l'appli ; s'il ne l'était pas, on ne devine pas. */
export async function blocUnique(lecteur: Db | Tx, code: string) {
  const blocs = await lecteur
    .select({
      id: t.blocs.id,
      code: t.blocs.code,
      moduleId: t.blocs.moduleId,
      titre: t.blocs.titre,
    })
    .from(t.blocs)
    .where(eq(t.blocs.code, code))
  const [bloc] = blocs
  return blocs.length === 1 ? bloc : undefined
}

/** La version de fiche la plus récente d'un bloc : celle en service. */
export async function versionEnService(lecteur: Db | Tx, blocId: string) {
  const [version] = await lecteur
    .select({
      id: t.fichesVersions.id,
      version: t.fichesVersions.version,
      empreinte: t.fichesVersions.empreinte,
      chemin: t.fichesVersions.chemin,
      manifeste: t.fichesVersions.manifeste,
    })
    .from(t.fichesVersions)
    .where(eq(t.fichesVersions.blocId, blocId))
    .orderBy(desc(t.fichesVersions.version))
    .limit(1)
  return version
}

/** Qui a écrit l'événement, et avec quelle empreinte : de quoi reconnaître un message rejoué. */
export async function empreinteDeLEvenement(lecteur: Db | Tx, id: string) {
  const [ligne] = await lecteur
    .select({ userId: t.evenements.userId, empreinte: t.evenements.empreinte })
    .from(t.evenements)
    .where(eq(t.evenements.id, id))
  return ligne
}

/** La série de questions de début de séance gardée pour ce jour, telle que stockée. */
export async function serieDuJour(
  lecteur: Db | Tx,
  userId: string,
  jour: string,
): Promise<unknown> {
  const [ligne] = await lecteur
    .select({ questions: t.seriesQuestionsDebut.questions })
    .from(t.seriesQuestionsDebut)
    .where(and(eq(t.seriesQuestionsDebut.userId, userId), eq(t.seriesQuestionsDebut.jour, jour)))
  return ligne?.questions
}

/**
 * Ajoute la ligne ; rend faux si elle existait déjà (l'identifiant, ou la `cible` si on la donne), sans
 * erreur qui ferait avorter la transaction.
 */
export async function ajouterSiAbsent<T extends PgTable & { readonly id: AnyPgColumn }>(
  lecteur: Db | Tx,
  table: T,
  valeurs: T['$inferInsert'],
  cible?: AnyPgColumn,
): Promise<boolean> {
  const ajoutees = await lecteur
    .insert(table)
    .values(valeurs)
    .onConflictDoNothing(cible === undefined ? undefined : { target: cible })
    .returning({ id: table.id })
  return ajoutees.length > 0
}
