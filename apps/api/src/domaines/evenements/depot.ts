import { and, eq } from 'drizzle-orm'
import { instantIso } from '../../base/instant.ts'
import {
  ajouterSiAbsent,
  blocUnique,
  empreinteDeLEvenement,
  reglagesDe,
  versionEnService,
} from '../../base/requetes.ts'
import * as t from '../../base/schema/index.ts'
import type { Db, Tx } from '../../base/transaction.ts'

export interface Evenement {
  readonly id: string
  readonly userId: string
  readonly blocId: string
  readonly ficheVersionId: string
  readonly type: string
  readonly donnees: unknown
  readonly empreinte: string
  readonly aide: number | null
  readonly dateServeur: string
}

export interface DecisionErreur {
  readonly id: string
  readonly userId: string
  readonly blocId: string
  readonly erreurId: string
  readonly decision: 'cochee' | 'decochee' | 'confirmee' | 'rejetee'
  /** Pour cochée et décochée seulement. */
  readonly source: 'amine' | null
  /** Pour confirmée et rejetée seulement. */
  readonly correctionId: string | null
  readonly dateServeur: string
}

export interface StatutForce {
  readonly id: string
  readonly userId: string
  readonly blocId: string
  readonly action: 'forcer' | 'lever'
  readonly statut: string | null
  readonly raison: string | null
  readonly dateServeur: string
}

/** Les ordres SQL des événements et de l'état de page. */
export function creerDepotEvenements() {
  return {
    /** Le bloc de ce code, la version de fiche demandée (la dernière si aucune) et le manifeste en service. */
    blocEtVersions: async (lecteur: Db | Tx, code: string, version: number | undefined) => {
      const bloc = await blocUnique(lecteur, code)
      if (bloc === undefined) return undefined
      const enService = await versionEnService(lecteur, bloc.id)
      if (enService === undefined) return undefined
      if (version === undefined)
        return { bloc, versionDemandee: enService.id, manifeste: enService.manifeste }
      const [demandee] = await lecteur
        .select({ id: t.fichesVersions.id })
        .from(t.fichesVersions)
        .where(and(eq(t.fichesVersions.blocId, bloc.id), eq(t.fichesVersions.version, version)))
      return { bloc, versionDemandee: demandee?.id, manifeste: enService.manifeste }
    },

    blocParCode: blocUnique,

    reglagesDe,

    evenementParId: empreinteDeLEvenement,

    /**
     * Ajoute l'événement ; rend faux si l'identifiant existait déjà. Le verrou est par bloc : deux
     * blocs peuvent poster le même identifiant en même temps, et la base tranche (sans erreur qui
     * ferait avorter la transaction).
     */
    ajouterEvenement: (tx: Tx, evenement: Evenement): Promise<boolean> =>
      ajouterSiAbsent(tx, t.evenements, evenement, t.evenements.id),

    ajouterDecisions: async (tx: Tx, decisions: readonly DecisionErreur[]): Promise<void> => {
      if (decisions.length > 0) await tx.insert(t.decisionsErreurs).values([...decisions])
    },

    forceParId: async (lecteur: Db | Tx, id: string) => {
      const [ligne] = await lecteur
        .select({
          userId: t.statutsForces.userId,
          blocId: t.statutsForces.blocId,
          action: t.statutsForces.action,
          statut: t.statutsForces.statut,
          raison: t.statutsForces.raison,
        })
        .from(t.statutsForces)
        .where(eq(t.statutsForces.id, id))
      return ligne
    },

    ajouterForce: async (tx: Tx, force: StatutForce): Promise<void> => {
      await tx.insert(t.statutsForces).values(force)
    },

    decisionParId: async (lecteur: Db | Tx, id: string) => {
      const [ligne] = await lecteur
        .select({
          userId: t.decisionsErreurs.userId,
          blocId: t.decisionsErreurs.blocId,
          erreurId: t.decisionsErreurs.erreurId,
          decision: t.decisionsErreurs.decision,
          correctionId: t.decisionsErreurs.correctionId,
        })
        .from(t.decisionsErreurs)
        .where(eq(t.decisionsErreurs.id, id))
      return ligne
    },

    /** La correction d'un utilisateur et les erreurs que l'IA y a repérées. */
    correctionParId: async (lecteur: Db | Tx, userId: string, id: string) => {
      const [ligne] = await lecteur
        .select({ blocId: t.corrections.blocId, erreursIds: t.corrections.erreursIds })
        .from(t.corrections)
        .where(and(eq(t.corrections.id, id), eq(t.corrections.userId, userId)))
      return ligne
    },

    /**
     * Écrit l'état d'une page si l'onglet a lu la bonne version (0 : il n'y en a pas encore).
     * Rend la nouvelle version, ou `undefined` si une autre a pris la place.
     */
    ecrireEtat: async (
      lecteur: Db | Tx,
      o: { userId: string; blocId: string; version: number; etat: unknown; maintenant: string },
    ): Promise<number | undefined> => {
      if (o.version === 0) {
        const [cree] = await lecteur
          .insert(t.etatsPage)
          .values({
            userId: o.userId,
            blocId: o.blocId,
            etat: o.etat,
            version: 1,
            misAJourLe: o.maintenant,
          })
          .onConflictDoNothing()
          .returning({ version: t.etatsPage.version })
        return cree?.version
      }
      const [modifie] = await lecteur
        .update(t.etatsPage)
        .set({ etat: o.etat, version: o.version + 1, misAJourLe: o.maintenant })
        .where(
          and(
            eq(t.etatsPage.userId, o.userId),
            eq(t.etatsPage.blocId, o.blocId),
            eq(t.etatsPage.version, o.version),
          ),
        )
        .returning({ version: t.etatsPage.version })
      return modifie?.version
    },

    etatActuel: async (lecteur: Db | Tx, userId: string, blocId: string) => {
      const [ligne] = await lecteur
        .select({
          version: t.etatsPage.version,
          etat: t.etatsPage.etat,
          modifieLe: instantIso(t.etatsPage.misAJourLe),
        })
        .from(t.etatsPage)
        .where(and(eq(t.etatsPage.userId, userId), eq(t.etatsPage.blocId, blocId)))
      return ligne
    },
  }
}
export type DepotEvenements = ReturnType<typeof creerDepotEvenements>
