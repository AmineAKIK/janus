import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm'
import type { Base } from '../../base/base.ts'
import { instantIso } from '../../base/instant.ts'
import * as t from '../../base/schema/index.ts'
import type { Tx } from '../../base/transaction.ts'

export interface Utilisateur {
  readonly id: string
  readonly nomUtilisateur: string
  readonly motDePasseHash: string
  readonly reglages: unknown
}

export interface SessionStockee {
  readonly id: string
  readonly userId: string
  readonly appareil: string | null
  readonly persistante: boolean
  readonly creeLe: string
  readonly expireLe: string
  readonly derniereActivite: string
}

export interface NouvelleSession {
  readonly id: string
  readonly userId: string
  readonly empreinteJeton: string
  readonly creeLe: string
  readonly appareil: string
  readonly persistante: boolean
  /** La durée de vie maximale de la session, en jours. */
  readonly dureeJours: number
}

const colonnesUtilisateur = {
  id: t.users.id,
  nomUtilisateur: t.users.nomUtilisateur,
  motDePasseHash: t.users.motDePasseHash,
  reglages: t.users.reglages,
}

const colonnesSession = {
  id: t.sessions.id,
  userId: t.sessions.userId,
  appareil: t.sessions.appareil,
  persistante: t.sessions.persistante,
  creeLe: instantIso(t.sessions.creeLe),
  expireLe: instantIso(t.sessions.expireLe),
  derniereActivite: instantIso(t.sessionsActivite.derniereActivite),
}

/** Les ordres SQL de l'authentification : sessions, utilisateur, suppression d'un compte. */
export function creerDepotAuth(base: Base, proprietaire: Base) {
  /** Une session vivante est une session qui n'a pas été révoquée ; l'expiration est décidée par la policy. */
  const sessionsNonRevoquees = () =>
    base.db
      .select(colonnesSession)
      .from(t.sessions)
      .innerJoin(t.sessionsActivite, eq(t.sessionsActivite.sessionId, t.sessions.id))
      .leftJoin(t.sessionsRevoquees, eq(t.sessionsRevoquees.sessionId, t.sessions.id))

  return {
    utilisateurParNom: async (nom: string): Promise<Utilisateur | undefined> => {
      const [ligne] = await base.db
        .select(colonnesUtilisateur)
        .from(t.users)
        .where(sql`lower(${t.users.nomUtilisateur}) = lower(${nom})`)
      return ligne
    },

    utilisateur: async (id: string): Promise<Utilisateur | undefined> => {
      const [ligne] = await base.db
        .select(colonnesUtilisateur)
        .from(t.users)
        .where(eq(t.users.id, id))
      return ligne
    },

    creerSession: async (session: NouvelleSession): Promise<void> => {
      await base.enTransaction(async (tx) => {
        await tx.insert(t.sessions).values({
          id: session.id,
          userId: session.userId,
          empreinteJeton: session.empreinteJeton,
          creeLe: session.creeLe,
          expireLe: sql`${session.creeLe}::timestamptz + make_interval(days => ${session.dureeJours})`,
          appareil: session.appareil,
          persistante: session.persistante,
        })
        await tx
          .insert(t.sessionsActivite)
          .values({ sessionId: session.id, derniereActivite: session.creeLe })
      })
    },

    sessionParEmpreinte: async (empreinte: string): Promise<SessionStockee | undefined> => {
      const [ligne] = await sessionsNonRevoquees().where(
        and(eq(t.sessions.empreinteJeton, empreinte), isNull(t.sessionsRevoquees.sessionId)),
      )
      return ligne
    },

    sessionsDe: (userId: string): Promise<SessionStockee[]> =>
      sessionsNonRevoquees()
        .where(and(eq(t.sessions.userId, userId), isNull(t.sessionsRevoquees.sessionId)))
        .orderBy(desc(t.sessionsActivite.derniereActivite)),

    sessionDe: async (userId: string, id: string): Promise<SessionStockee | undefined> => {
      const [ligne] = await sessionsNonRevoquees().where(
        and(
          eq(t.sessions.id, id),
          eq(t.sessions.userId, userId),
          isNull(t.sessionsRevoquees.sessionId),
        ),
      )
      return ligne
    },

    toucher: async (id: string, instant: string): Promise<void> => {
      await base.db
        .update(t.sessionsActivite)
        .set({ derniereActivite: instant })
        .where(eq(t.sessionsActivite.sessionId, id))
    },

    revoquer: async (id: string, instant: string): Promise<void> => {
      await base.db
        .insert(t.sessionsRevoquees)
        .values({ sessionId: id, revoqueeLe: instant })
        .onConflictDoNothing()
    },

    /** Change le hachage et révoque les autres sessions, ensemble ou pas du tout. */
    changerMotDePasse: (
      userId: string,
      hash: string,
      sessionCouranteId: string | null,
      instant: string,
    ): Promise<void> =>
      base.enTransaction(async (tx) => {
        await tx.update(t.users).set({ motDePasseHash: hash }).where(eq(t.users.id, userId))
        const autres = await tx
          .select({ id: t.sessions.id })
          .from(t.sessions)
          .leftJoin(t.sessionsRevoquees, eq(t.sessionsRevoquees.sessionId, t.sessions.id))
          .where(
            and(
              eq(t.sessions.userId, userId),
              isNull(t.sessionsRevoquees.sessionId),
              sessionCouranteId === null ? undefined : ne(t.sessions.id, sessionCouranteId),
            ),
          )
        if (autres.length > 0) {
          await tx
            .insert(t.sessionsRevoquees)
            .values(autres.map(({ id }) => ({ sessionId: id, revoqueeLe: instant })))
            .onConflictDoNothing()
        }
      }),

    /** Efface tout ce qui appartient à l'utilisateur, avec le rôle propriétaire : le seul cas où des faits disparaissent. */
    supprimerCompte: (userId: string): Promise<void> =>
      proprietaire.enTransaction((tx) => effacerLesDonnees(tx, userId)),
  }
}
export type DepotAuth = ReturnType<typeof creerDepotAuth>

async function effacerLesDonnees(tx: Tx, userId: string): Promise<void> {
  const sessionsDe = tx
    .select({ id: t.sessions.id })
    .from(t.sessions)
    .where(eq(t.sessions.userId, userId))
  await tx
    .delete(t.sessionsRevoquees)
    .where(sql`${t.sessionsRevoquees.sessionId} IN (${sessionsDe})`)
  await tx.delete(t.sessionsActivite).where(sql`${t.sessionsActivite.sessionId} IN (${sessionsDe})`)
  // Ce qui référence un autre fait d'abord : les décisions pointent des corrections.
  await tx.delete(t.decisionsErreurs).where(eq(t.decisionsErreurs.userId, userId))
  const parUtilisateur = [
    t.corrections,
    t.evenements,
    t.statutsForces,
    t.notesJournal,
    t.idees,
    t.revuesMethode,
    t.verificationsTirees,
    t.seriesQuestionsDebut,
    t.rappelsEnvoyes,
    t.sessions,
    t.statutsCourants,
    t.echeances,
    t.revuesFsrs,
    t.journal,
    t.budgetIa,
    t.abonnementsPush,
    t.etatsPage,
  ] as const
  for (const table of parUtilisateur) {
    await tx.delete(table).where(eq(table.userId, userId))
  }
  await tx.delete(t.users).where(eq(t.users.id, userId))
}
