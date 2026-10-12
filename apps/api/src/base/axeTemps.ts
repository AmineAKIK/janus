import { instantEnIso, instantEnMs } from '@janus/moteur'
import { Reglages } from '@janus/contrats'
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { Horloge } from '../horloge.ts'
import { formationActiveDe } from './formationActive.ts'
import { instantIso } from './instant.ts'
import * as t from './schema/index.ts'
import type { Db, Tx } from './transaction.ts'

const JOUR_MS = 86_400_000

/** Une période où la formation était gelée ; `fin` est nulle tant qu'elle l'est. */
export interface Pause {
  readonly debut: string
  readonly fin: string | null
}

/**
 * Ce qu'une pause finie retire au temps de la formation : ses jours entiers. Une pause de 3 jours
 * et 10 heures rend 3 jours, pour que la bascule de 4 h ne se décale pas d'une reprise à l'autre.
 */
export function dureeRetiree({ debut, fin }: Pause): number {
  if (fin === null) return 0
  return Math.floor((instantEnMs(fin) - instantEnMs(debut)) / JOUR_MS) * JOUR_MS
}

/**
 * Le temps de la formation à l'instant `maintenant` : l'instant réel moins ses pauses. Gelée, elle ne
 * dépasse pas le début de sa pause en cours. Les faits qu'on écrit portent ce temps, donc les délais
 * (consolidation, vérification, rappels) ne comptent jamais les jours de pause.
 */
export function tempsDeLaFormation(maintenant: string, pauses: readonly Pause[]): string {
  let borne = instantEnMs(maintenant)
  let retire = 0
  for (const pause of pauses) {
    if (pause.fin === null) borne = Math.min(borne, instantEnMs(pause.debut))
    else retire += dureeRetiree(pause)
  }
  return instantEnIso(borne - retire)
}

async function pausesDe(lecteur: Db | Tx, userId: string, formationId: string): Promise<Pause[]> {
  const lignes = await lecteur
    .select({
      debut: instantIso(t.pausesFormation.debut),
      fin: sql<
        string | null
      >`CASE WHEN ${t.pausesFormation.fin} IS NULL THEN NULL ELSE ${instantIso(t.pausesFormation.fin)} END`,
    })
    .from(t.pausesFormation)
    .where(
      and(eq(t.pausesFormation.userId, userId), eq(t.pausesFormation.formationId, formationId)),
    )
  return lignes
}

/** Le temps d'une formation pour cet utilisateur ; l'heure réelle quand aucune formation n'est en jeu. */
export async function maintenantDeLaFormation(
  lecteur: Db | Tx,
  horloge: Horloge,
  userId: string,
  formationId: string | null,
): Promise<string> {
  const reel = horloge.maintenant()
  if (formationId === null) return reel
  return tempsDeLaFormation(reel, await pausesDe(lecteur, userId, formationId))
}

/** Le temps de la formation que l'utilisateur affiche. */
export async function maintenantActif(
  lecteur: Db | Tx,
  horloge: Horloge,
  userId: string,
): Promise<string> {
  const [ligne] = await lecteur
    .select({ reglages: t.users.reglages })
    .from(t.users)
    .where(eq(t.users.id, userId))
  const choisie = ligne === undefined ? null : Reglages.parse(ligne.reglages).formationActive
  return maintenantDeLaFormation(
    lecteur,
    horloge,
    userId,
    await formationActiveDe(lecteur, choisie),
  )
}

/** Le temps de la formation qui contient ce bloc. */
export async function maintenantDuBloc(
  lecteur: Db | Tx,
  horloge: Horloge,
  userId: string,
  blocId: string,
): Promise<string> {
  const [ligne] = await lecteur
    .select({ formationId: t.modules.formationId })
    .from(t.blocs)
    .innerJoin(t.modules, eq(t.modules.id, t.blocs.moduleId))
    .where(eq(t.blocs.id, blocId))
  return maintenantDeLaFormation(lecteur, horloge, userId, ligne?.formationId ?? null)
}

/**
 * Gèle la formation qu'on quitte et reprend celle qu'on ouvre, à l'instant réel `maintenant`.
 * Les faits ne bougent pas : seul le temps de la formation reprend où il s'était arrêté.
 */
export async function changerDeFormation(
  tx: Tx,
  userId: string,
  { avant, apres }: { avant: string | null; apres: string | null },
  maintenant: string,
): Promise<void> {
  if (avant === apres) return
  if (avant !== null) {
    await tx
      .insert(t.pausesFormation)
      .values({ userId, formationId: avant, debut: maintenant })
      .onConflictDoNothing()
  }
  if (apres !== null) {
    await tx
      .update(t.pausesFormation)
      .set({ fin: maintenant })
      .where(
        and(
          eq(t.pausesFormation.userId, userId),
          eq(t.pausesFormation.formationId, apres),
          isNull(t.pausesFormation.fin),
        ),
      )
  }
}
