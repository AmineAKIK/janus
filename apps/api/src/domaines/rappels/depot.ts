import { and, eq, exists } from 'drizzle-orm'
import { ajouterSiAbsent } from '../../base/requetes.ts'
import * as t from '../../base/schema/index.ts'
import type { Db, Tx } from '../../base/transaction.ts'

export interface NouvelAbonnement {
  readonly id: string
  readonly userId: string
  readonly endpoint: string
  readonly p256dh: string
  readonly auth: string
  readonly creeLe: string
}

/** Les ordres SQL des abonnements push et des rappels déjà envoyés. */
export function creerDepotRappels() {
  return {
    /** Les utilisateurs qui ont au moins un abonnement : les seuls à qui un rappel peut parvenir. */
    destinataires: (lecteur: Db | Tx) =>
      lecteur
        .select({ id: t.users.id, reglages: t.users.reglages })
        .from(t.users)
        .where(
          exists(
            lecteur
              .select({ id: t.abonnementsPush.id })
              .from(t.abonnementsPush)
              .where(eq(t.abonnementsPush.userId, t.users.id)),
          ),
        ),

    abonnementsDe: (lecteur: Db | Tx, userId: string) =>
      lecteur
        .select({
          id: t.abonnementsPush.id,
          endpoint: t.abonnementsPush.endpoint,
          p256dh: t.abonnementsPush.p256dh,
          auth: t.abonnementsPush.auth,
        })
        .from(t.abonnementsPush)
        .where(eq(t.abonnementsPush.userId, userId)),

    /** Le propriétaire de l'abonnement `id`, `undefined` s'il n'existe pas. */
    proprietaireDe: async (lecteur: Db | Tx, id: string) => {
      const [ligne] = await lecteur
        .select({ userId: t.abonnementsPush.userId })
        .from(t.abonnementsPush)
        .where(eq(t.abonnementsPush.id, id))
      return ligne?.userId
    },

    /**
     * Enregistre l'abonnement. La même adresse rendue par le navigateur le remplace (clés et
     * propriétaire à jour) et garde son identifiant ; on rend l'identifiant retenu.
     */
    ajouter: async (tx: Tx, abonnement: NouvelAbonnement): Promise<string> => {
      const [ligne] = await tx
        .insert(t.abonnementsPush)
        .values(abonnement)
        .onConflictDoUpdate({
          target: t.abonnementsPush.endpoint,
          set: { userId: abonnement.userId, p256dh: abonnement.p256dh, auth: abonnement.auth },
        })
        .returning({ id: t.abonnementsPush.id })
      return ligne?.id ?? abonnement.id
    },

    supprimer: async (tx: Tx | Db, id: string, userId?: string) => {
      await tx
        .delete(t.abonnementsPush)
        .where(
          userId === undefined
            ? eq(t.abonnementsPush.id, id)
            : and(eq(t.abonnementsPush.id, id), eq(t.abonnementsPush.userId, userId)),
        )
    },

    /** Rend le jour : le rappel n'a pu être envoyé à personne, le prochain passage le retentera. */
    liberer: async (lecteur: Db | Tx, userId: string, jour: string): Promise<void> => {
      await lecteur
        .delete(t.rappelsEnvoyes)
        .where(and(eq(t.rappelsEnvoyes.userId, userId), eq(t.rappelsEnvoyes.jour, jour)))
    },

    /** Réserve le rappel du jour avant l'envoi : faux si un autre passage l'a déjà réservé. */
    reserver: (
      lecteur: Db | Tx,
      rappel: { id: string; userId: string; jour: string; envoyeLe: string },
    ): Promise<boolean> => ajouterSiAbsent(lecteur, t.rappelsEnvoyes, rappel),
  }
}
export type DepotRappels = ReturnType<typeof creerDepotRappels>
