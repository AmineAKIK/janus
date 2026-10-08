import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { instantIso } from '../../base/instant.ts'
import * as t from '../../base/schema/index.ts'
import type { Db, Tx } from '../../base/transaction.ts'

export interface QuestionTiree {
  readonly bloc: string
  readonly question: string
}

/** Les ordres SQL de la séance du jour. */
export function creerDepotRevisions() {
  return {
    reglagesDe: async (lecteur: Db | Tx, userId: string): Promise<unknown> => {
      const [ligne] = await lecteur
        .select({ reglages: t.users.reglages })
        .from(t.users)
        .where(eq(t.users.id, userId))
      return ligne?.reglages
    },

    /** Les blocs des modules importés, dans l'ordre du plan, avec le manifeste en service. */
    blocsDuPlan: async (lecteur: Db | Tx) => {
      const lignes = await lecteur
        .select({
          id: t.blocs.id,
          code: t.blocs.code,
          moduleId: t.blocs.moduleId,
          manifeste: t.fichesVersions.manifeste,
          version: t.fichesVersions.version,
        })
        .from(t.blocs)
        .innerJoin(t.modules, eq(t.modules.id, t.blocs.moduleId))
        .innerJoin(t.fichesVersions, eq(t.fichesVersions.blocId, t.blocs.id))
        .where(eq(t.modules.importe, true))
        .orderBy(asc(t.modules.ordre), asc(t.blocs.ordre), desc(t.fichesVersions.version))
      // Une ligne par version : la plus récente vient en premier pour chaque bloc.
      const vus = new Set<string>()
      return lignes.filter(({ id }) => (vus.has(id) ? false : (vus.add(id), true)))
    },

    /** La série tirée pour ce jour, si elle l'a déjà été. */
    serieDuJour: async (lecteur: Db | Tx, userId: string, jour: string): Promise<unknown> => {
      const [ligne] = await lecteur
        .select({ questions: t.seriesQuestionsDebut.questions })
        .from(t.seriesQuestionsDebut)
        .where(
          and(eq(t.seriesQuestionsDebut.userId, userId), eq(t.seriesQuestionsDebut.jour, jour)),
        )
      return ligne?.questions
    },

    /** Garde la série du jour : si une autre requête l'a gardée avant, la sienne est conservée. */
    garderSerie: async (
      tx: Tx,
      o: {
        id: string
        userId: string
        jour: string
        questions: readonly QuestionTiree[]
        dateServeur: string
      },
    ): Promise<void> => {
      await tx
        .insert(t.seriesQuestionsDebut)
        .values({ ...o, questions: [...o.questions] })
        .onConflictDoNothing()
    },

    /** Les corrections `rappel` de l'utilisateur sur ces blocs, de la plus ancienne à la plus récente. */
    rappelsDe: async (lecteur: Db | Tx, userId: string, blocIds: readonly string[]) =>
      blocIds.length === 0
        ? []
        : lecteur
            .select({
              id: t.corrections.id,
              blocId: t.corrections.blocId,
              questionId: t.corrections.questionId,
              tour: t.corrections.tour,
              confiance: t.corrections.confiance,
              reponse: t.corrections.reponse,
              message: t.corrections.message,
              niveau: t.corrections.niveau,
              erreursIds: t.corrections.erreursIds,
              source: t.corrections.source,
              ref: t.corrections.ref,
              certitude: t.corrections.certitude,
              compte: t.corrections.compte,
              raisonNonCompte: t.corrections.raisonNonCompte,
              echantillon: t.corrections.echantillon,
              date: instantIso(t.corrections.dateServeur),
            })
            .from(t.corrections)
            .where(
              and(
                eq(t.corrections.userId, userId),
                eq(t.corrections.serie, 'rappel'),
                inArray(t.corrections.blocId, [...blocIds]),
              ),
            )
            .orderBy(asc(t.corrections.dateServeur), asc(t.corrections.tour)),
  }
}
export type DepotRevisions = ReturnType<typeof creerDepotRevisions>
