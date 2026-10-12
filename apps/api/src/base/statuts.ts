import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm'
import type { Db, Tx } from './transaction.ts'
import * as t from './schema/index.ts'

// Les ordres SQL du recalcul d'un bloc (`recalcul.ts` en décide, ce fichier les pose) : les lignes
// calculées (`statuts_courants`, `echeances`) et ce qu'il faut lire pour recalculer un bloc.

export interface StatutCourant {
  readonly userId: string
  readonly blocId: string
  readonly statutCalcule: string
  readonly detail: unknown
  readonly versionMoteur: number
  readonly calculeLe: string
}

/** Range le statut calculé d'un bloc : une ligne par utilisateur et par bloc, remplacée à chaque calcul. */
export async function ecrireStatutCourant(tx: Tx, statut: StatutCourant): Promise<void> {
  await tx
    .insert(t.statutsCourants)
    .values(statut)
    .onConflictDoUpdate({
      target: [t.statutsCourants.userId, t.statutsCourants.blocId],
      set: {
        statutCalcule: sql`excluded.statut_calcule`,
        detail: sql`excluded.detail`,
        versionMoteur: sql`excluded.version_moteur`,
        calculeLe: sql`excluded.calcule_le`,
      },
    })
}

/** Les échéances d'un bloc qui ne sont pas encore faites. */
export function echeancesEnCours(tx: Tx, userId: string, blocId: string) {
  return tx
    .select({ id: t.echeances.id, type: t.echeances.type })
    .from(t.echeances)
    .where(
      and(
        eq(t.echeances.userId, userId),
        eq(t.echeances.blocId, blocId),
        isNull(t.echeances.faiteLe),
      ),
    )
}

export async function cloreEcheance(tx: Tx, id: string, faiteLe: string): Promise<void> {
  await tx.update(t.echeances).set({ faiteLe }).where(eq(t.echeances.id, id))
}

export async function majEcheance(
  tx: Tx,
  id: string,
  valeurs: { genre: string; dueLe: string; versionMoteur: number },
): Promise<void> {
  await tx.update(t.echeances).set(valeurs).where(eq(t.echeances.id, id))
}

export async function ajouterEcheance(
  tx: Tx,
  echeance: {
    id: string
    userId: string
    blocId: string
    type: string
    genre: string
    dueLe: string
    versionMoteur: number
  },
): Promise<void> {
  await tx.insert(t.echeances).values(echeance)
}

/** Les blocs dont la ligne calculée vient d'une autre version des règles du moteur. */
export function statutsPerimes(db: Db, versionMoteur: number) {
  return db
    .select({ userId: t.statutsCourants.userId, blocId: t.statutsCourants.blocId })
    .from(t.statutsCourants)
    .where(ne(t.statutsCourants.versionMoteur, versionMoteur))
}

/** Ce qu'il faut pour recalculer un bloc : le bloc, sa fiche en service, les réglages de l'utilisateur. */
export async function contexteDeRecalcul(tx: Tx, userId: string, blocId: string) {
  const [bloc] = await tx
    .select({ id: t.blocs.id, code: t.blocs.code })
    .from(t.blocs)
    .where(eq(t.blocs.id, blocId))
  const [enService] = await tx
    .select({ manifeste: t.fichesVersions.manifeste })
    .from(t.fichesVersions)
    .where(eq(t.fichesVersions.blocId, blocId))
    .orderBy(desc(t.fichesVersions.version))
    .limit(1)
  const [utilisateur] = await tx
    .select({ reglages: t.users.reglages })
    .from(t.users)
    .where(eq(t.users.id, userId))
  if (bloc === undefined || enService === undefined || utilisateur === undefined) return undefined
  return { bloc, manifeste: enService.manifeste, reglages: utilisateur.reglages }
}
