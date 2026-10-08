import { and, eq, sql } from 'drizzle-orm'
import * as t from '../../base/schema/index.ts'
import type { Db, Tx } from '../../base/transaction.ts'

/** Les ordres SQL des réglages d'un utilisateur et de leur version. */
export function creerDepotReglages() {
  return {
    lire: async (lecteur: Db | Tx, userId: string) => {
      const [ligne] = await lecteur
        .select({ reglages: t.users.reglages, version: t.users.reglagesVersion })
        .from(t.users)
        .where(eq(t.users.id, userId))
      return ligne
    },

    /** Écrit les réglages si la version est encore celle que le client a lue ; `undefined` sinon. */
    ecrire: async (tx: Tx, userId: string, version: number, reglages: unknown) => {
      const [ligne] = await tx
        .update(t.users)
        .set({ reglages, reglagesVersion: sql`${t.users.reglagesVersion} + 1` })
        .where(and(eq(t.users.id, userId), eq(t.users.reglagesVersion, version)))
        .returning({ version: t.users.reglagesVersion })
      return ligne?.version
    },
  }
}
export type DepotReglages = ReturnType<typeof creerDepotReglages>
