import { and, asc, count, desc, eq, gt, sql } from 'drizzle-orm'
import { instantIso } from '../../base/instant.ts'
import * as t from '../../base/schema/index.ts'
import type { Db, Tx } from '../../base/transaction.ts'

export interface LigneCorrection {
  readonly id: string
  readonly userId: string
  readonly blocId: string
  readonly questionId: string
  readonly serie: string
  readonly tentative: number
  readonly tour: number
  readonly confiance: string
  readonly reponse: string
  readonly supportColle: boolean
  readonly supportRetourCours: boolean
  readonly recopiee: boolean
  readonly message: string
  readonly niveau: string
  readonly erreursIds: unknown
  readonly source: string
  readonly ref: string
  readonly certitude: string
  readonly compte: boolean
  readonly raisonNonCompte: string | null
  readonly conteste: boolean
  readonly modele: string
  readonly parametres: unknown
  readonly jetonsEntree: number
  readonly jetonsSortie: number
  readonly coutMillioniemes: number
  readonly consigneEmpreinte: string
  readonly brut: string
  readonly echantillon: boolean
  readonly dateServeur: string
}

export interface EchecCorrection {
  readonly id: string
  readonly userId: string
  readonly blocId: string
  readonly questionId: string
  readonly serie: string
  readonly tentative: number
  readonly tour: number
  readonly motif: string
  readonly bruts: readonly string[]
  readonly modele: string
  readonly coutMillioniemes: number
  readonly dateServeur: string
}

/** Un fait de plus sur une correction : contestation, avis d'Amine, décision d'Amine. */
export interface FaitDeCorrection {
  readonly id: string
  readonly userId: string
  readonly blocId: string
  readonly ficheVersionId: string
  readonly type: 'correction_contestee' | 'correction.accord' | 'correction_tranchee'
  readonly donnees: Readonly<Record<string, unknown>>
  readonly empreinte: string
  readonly dateServeur: string
}

const colonnesCorrection = {
  id: t.corrections.id,
  userId: t.corrections.userId,
  blocId: t.corrections.blocId,
  questionId: t.corrections.questionId,
  serie: t.corrections.serie,
  tentative: t.corrections.tentative,
  tour: t.corrections.tour,
  confiance: t.corrections.confiance,
  reponse: t.corrections.reponse,
  supportColle: t.corrections.supportColle,
  supportRetourCours: t.corrections.supportRetourCours,
  recopiee: t.corrections.recopiee,
  message: t.corrections.message,
  niveau: t.corrections.niveau,
  erreursIds: t.corrections.erreursIds,
  source: t.corrections.source,
  ref: t.corrections.ref,
  certitude: t.corrections.certitude,
  compte: t.corrections.compte,
  raisonNonCompte: t.corrections.raisonNonCompte,
  conteste: t.corrections.conteste,
  modele: t.corrections.modele,
  parametres: t.corrections.parametres,
  jetonsEntree: t.corrections.jetonsEntree,
  jetonsSortie: t.corrections.jetonsSortie,
  coutMillioniemes: t.corrections.coutMillioniemes,
  consigneEmpreinte: t.corrections.consigneEmpreinte,
  brut: t.corrections.brut,
  echantillon: t.corrections.echantillon,
  dateServeur: instantIso(t.corrections.dateServeur),
}

/** Les ordres SQL des corrections et du budget IA. */
export function creerDepotCorrection() {
  return {
    /** Le bloc de ce code, la version de fiche demandée (si elle existe) et son manifeste. */
    blocEtVersion: async (lecteur: Db | Tx, code: string, version: number) => {
      const [ligne] = await lecteur
        .select({
          blocId: t.blocs.id,
          code: t.blocs.code,
          versionId: t.fichesVersions.id,
          manifeste: t.fichesVersions.manifeste,
        })
        .from(t.blocs)
        .innerJoin(t.fichesVersions, eq(t.fichesVersions.blocId, t.blocs.id))
        .where(and(eq(t.blocs.code, code), eq(t.fichesVersions.version, version)))
      return ligne
    },

    /** La dernière version de fiche d'un bloc : celle d'un rappel, dont la page n'est pas ouverte. */
    derniereVersion: async (lecteur: Db | Tx, code: string) => {
      const [ligne] = await lecteur
        .select({
          blocId: t.blocs.id,
          code: t.blocs.code,
          versionId: t.fichesVersions.id,
          manifeste: t.fichesVersions.manifeste,
        })
        .from(t.blocs)
        .innerJoin(t.fichesVersions, eq(t.fichesVersions.blocId, t.blocs.id))
        .where(eq(t.blocs.code, code))
        .orderBy(desc(t.fichesVersions.version))
        .limit(1)
      return ligne
    },

    /** La série de questions de début de séance gardée pour ce jour, telle que stockée. */
    serieDuJour: async (lecteur: Db | Tx, userId: string, jour: string): Promise<unknown> => {
      const [ligne] = await lecteur
        .select({ questions: t.seriesQuestionsDebut.questions })
        .from(t.seriesQuestionsDebut)
        .where(
          and(eq(t.seriesQuestionsDebut.userId, userId), eq(t.seriesQuestionsDebut.jour, jour)),
        )
      return ligne?.questions
    },

    reglagesDe: async (lecteur: Db | Tx, userId: string): Promise<unknown> => {
      const [ligne] = await lecteur
        .select({ reglages: t.users.reglages })
        .from(t.users)
        .where(eq(t.users.id, userId))
      return ligne?.reglages
    },

    correctionParId: async (lecteur: Db | Tx, id: string): Promise<LigneCorrection | undefined> => {
      const [ligne] = await lecteur
        .select(colonnesCorrection)
        .from(t.corrections)
        .where(eq(t.corrections.id, id))
      return ligne
    },

    /** Les corrections d'une question dans une série, de la plus ancienne à la plus récente. */
    correctionsDeLaQuestion: async (
      lecteur: Db | Tx,
      o: { userId: string; blocId: string; question: string; serie: string },
    ) =>
      lecteur
        .select({
          id: t.corrections.id,
          tentative: t.corrections.tentative,
          tour: t.corrections.tour,
          reponse: t.corrections.reponse,
          message: t.corrections.message,
        })
        .from(t.corrections)
        .where(
          and(
            eq(t.corrections.userId, o.userId),
            eq(t.corrections.blocId, o.blocId),
            eq(t.corrections.questionId, o.question),
            eq(t.corrections.serie, o.serie),
          ),
        )
        .orderBy(asc(t.corrections.dateServeur), asc(t.corrections.tour)),

    /** Les appels au correcteur depuis cet instant (corrections gardées et échecs), pour la limite par heure. */
    appelsDepuis: async (tx: Tx, userId: string, depuis: string): Promise<number> => {
      const [gardees] = await tx
        .select({ n: count() })
        .from(t.corrections)
        .where(and(eq(t.corrections.userId, userId), gt(t.corrections.dateServeur, depuis)))
      const [echecs] = await tx
        .select({ n: count() })
        .from(t.correctionsEchecs)
        .where(
          and(eq(t.correctionsEchecs.userId, userId), gt(t.correctionsEchecs.dateServeur, depuis)),
        )
      return (gardees?.n ?? 0) + (echecs?.n ?? 0)
    },

    /**
     * Réserve le coût annoncé d'un appel sur le budget du mois, d'un seul ordre : la ligne est
     * verrouillée par l'UPDATE, donc des demandes parallèles se comptent toutes. Faux si le plafond
     * serait dépassé.
     */
    reserver: async (
      tx: Tx,
      o: { userId: string; mois: string; plafond: number; estime: number },
    ): Promise<boolean> => {
      await tx
        .insert(t.budgetIa)
        .values({
          userId: o.userId,
          mois: o.mois,
          plafondMillioniemes: o.plafond,
          consommeMillioniemes: 0,
          reserveMillioniemes: 0,
        })
        .onConflictDoNothing()
      const reserve = await tx
        .update(t.budgetIa)
        .set({
          plafondMillioniemes: o.plafond,
          reserveMillioniemes: sql`${t.budgetIa.reserveMillioniemes} + ${o.estime}`,
        })
        .where(
          and(
            eq(t.budgetIa.userId, o.userId),
            eq(t.budgetIa.mois, o.mois),
            sql`${t.budgetIa.consommeMillioniemes} + ${t.budgetIa.reserveMillioniemes} + ${o.estime} <= ${o.plafond}`,
          ),
        )
        .returning({ reserve: t.budgetIa.reserveMillioniemes })
      return reserve.length === 1
    },

    /** Rend la réservation et inscrit le coût réel (jamais au-delà du plafond). */
    solder: async (
      tx: Tx,
      o: { userId: string; mois: string; estime: number; cout: number },
    ): Promise<void> => {
      await tx
        .update(t.budgetIa)
        .set({
          reserveMillioniemes: sql`${t.budgetIa.reserveMillioniemes} - ${o.estime}`,
          consommeMillioniemes: sql`LEAST(${t.budgetIa.consommeMillioniemes} + ${o.cout}, ${t.budgetIa.plafondMillioniemes} - (${t.budgetIa.reserveMillioniemes} - ${o.estime}))`,
        })
        .where(and(eq(t.budgetIa.userId, o.userId), eq(t.budgetIa.mois, o.mois)))
    },

    ajouterCorrection: async (tx: Tx, ligne: LigneCorrection): Promise<void> => {
      await tx.insert(t.corrections).values(ligne)
    },

    ajouterEchec: async (tx: Tx, echec: EchecCorrection): Promise<void> => {
      await tx.insert(t.correctionsEchecs).values({ ...echec, bruts: [...echec.bruts] })
    },

    ajouterFait: async (tx: Tx, fait: FaitDeCorrection): Promise<void> => {
      await tx.insert(t.evenements).values({ ...fait, aide: null })
    },

    evenementParId: async (lecteur: Db | Tx, id: string) => {
      const [ligne] = await lecteur
        .select({ userId: t.evenements.userId, empreinte: t.evenements.empreinte })
        .from(t.evenements)
        .where(eq(t.evenements.id, id))
      return ligne
    },

    /** Une correction de cet utilisateur, avec son bloc et le manifeste en service. */
    correctionEtBloc: async (lecteur: Db | Tx, userId: string, id: string) => {
      const [ligne] = await lecteur
        .select({ blocId: t.corrections.blocId, code: t.blocs.code })
        .from(t.corrections)
        .innerJoin(t.blocs, eq(t.blocs.id, t.corrections.blocId))
        .where(and(eq(t.corrections.id, id), eq(t.corrections.userId, userId)))
      if (ligne === undefined) return undefined
      const [version] = await lecteur
        .select({ id: t.fichesVersions.id, manifeste: t.fichesVersions.manifeste })
        .from(t.fichesVersions)
        .where(eq(t.fichesVersions.blocId, ligne.blocId))
        .orderBy(desc(t.fichesVersions.version))
        .limit(1)
      return version === undefined ? undefined : { ...ligne, version }
    },
  }
}
export type DepotCorrection = ReturnType<typeof creerDepotCorrection>
