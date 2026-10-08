import { Reglages, StatutBloc } from '@janus/contrats'
import type { Manifeste, StatutBloc as StatutBlocApi } from '@janus/contrats'
import { calculerBloc, debutDuJour, echeances, lignesDuJournal } from '@janus/moteur'
import type { Echeance } from '@janus/moteur'
import type { ResultatBloc } from '@janus/moteur'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { lireFaits } from './base/faits.ts'
import { nouvelId } from '@janus/contrats'
import { instantEnMs } from '@janus/moteur'
import * as t from './base/schema/index.ts'
import { verrouBloc } from './base/transaction.ts'
import type { Tx } from './base/transaction.ts'

/** La version des règles du moteur qui ont produit une ligne calculée : si elle change, on recalcule tout. */
export const VERSION_MOTEUR = 1

export interface OptionsRecalcul {
  readonly userId: string
  readonly bloc: { readonly id: string; readonly code: string }
  readonly manifeste: Manifeste
  readonly reglages: Reglages
  readonly maintenant: string
}

/** Ce que l'API rend d'un bloc après un fait : son statut, ce qui manque, les erreurs ouvertes. */
export function versStatutBloc(resultat: ResultatBloc): StatutBlocApi {
  return StatutBloc.parse({
    statut: resultat.statut,
    manque: resultat.manque.map((manque) => ({
      code: manque.code,
      ...(manque.questions === undefined ? {} : { questions: [...manque.questions] }),
      ...(manque.exercices === undefined ? {} : { exercices: [...manque.exercices] }),
      ...(manque.erreurs === undefined ? {} : { erreurs: [...manque.erreurs] }),
      ...(manque.apres === undefined ? {} : { apres: manque.apres }),
      ...(manque.points === undefined ? {} : { points: manque.points }),
      ...(manque.requis === undefined ? {} : { requis: manque.requis }),
    })),
    erreurs_ouvertes: [...resultat.erreursOuvertes],
  })
}

/**
 * Recalcule un bloc depuis tous ses faits, dans la transaction de l'écriture, et range le résultat
 * dans `statuts_courants`. Le verrou du bloc fait attendre un autre écrivain du même bloc.
 */
export async function recalculer(
  tx: Tx,
  { userId, bloc, manifeste, reglages, maintenant }: OptionsRecalcul,
): Promise<ResultatBloc> {
  await verrouBloc(tx, userId, bloc.id)
  const faits = await lireFaits(tx, userId, [bloc])
  const resultat = calculerBloc(faits, manifeste, reglages, maintenant)
  const detail = { ...versStatutBloc(resultat), force: resultat.force }
  await tx
    .insert(t.statutsCourants)
    .values({
      userId,
      blocId: bloc.id,
      statutCalcule: resultat.statutCalcule,
      detail,
      versionMoteur: VERSION_MOTEUR,
      calculeLe: maintenant,
    })
    .onConflictDoUpdate({
      target: [t.statutsCourants.userId, t.statutsCourants.blocId],
      set: {
        statutCalcule: sql`excluded.statut_calcule`,
        detail: sql`excluded.detail`,
        versionMoteur: sql`excluded.version_moteur`,
        calculeLe: sql`excluded.calcule_le`,
      },
    })
  const echeance = echeances(resultat, reglages)
  await rangerEcheance(tx, { userId, blocId: bloc.id, echeance, reglages, maintenant })
  await refaireJournal(tx, { userId, bloc: bloc.id, faits, manifeste, reglages, maintenant })
  return resultat
}

/** L'instant à partir duquel une échéance est due : tel quel, ou le début du jour. */
function dueLe(echeance: Echeance, reglages: Reglages): string {
  return echeance.genre === 'instant'
    ? echeance.apres
    : debutDuJour(echeance.apres, reglages.fuseau, reglages.heureBascule)
}

/**
 * Une seule échéance en cours par bloc. Si le type change, l'ancienne est faite (on est passé à
 * l'étape suivante) ; s'il reste le même, sa date se met à jour (après un échec, elle recule).
 */
async function rangerEcheance(
  tx: Tx,
  o: {
    userId: string
    blocId: string
    echeance: Echeance | null
    reglages: Reglages
    maintenant: string
  },
): Promise<void> {
  const enCours = await tx
    .select({ id: t.echeances.id, type: t.echeances.type })
    .from(t.echeances)
    .where(
      and(
        eq(t.echeances.userId, o.userId),
        eq(t.echeances.blocId, o.blocId),
        isNull(t.echeances.faiteLe),
      ),
    )
  const memeType = enCours.find(({ type }) => type === o.echeance?.type)
  const aClore = enCours.filter(({ id }) => id !== memeType?.id)
  for (const { id } of aClore) {
    await tx.update(t.echeances).set({ faiteLe: o.maintenant }).where(eq(t.echeances.id, id))
  }
  if (o.echeance === null) return
  const valeurs = {
    genre: o.echeance.genre,
    dueLe: dueLe(o.echeance, o.reglages),
    versionMoteur: VERSION_MOTEUR,
  }
  if (memeType === undefined) {
    await tx.insert(t.echeances).values({
      id: nouvelId(instantEnMs(o.maintenant)),
      userId: o.userId,
      blocId: o.blocId,
      type: o.echeance.type,
      ...valeurs,
    })
  } else {
    await tx.update(t.echeances).set(valeurs).where(eq(t.echeances.id, memeType.id))
  }
}

/** Les lignes du journal d'un bloc se refont depuis ses faits : on remplace tout ce qu'on en avait gardé. */
async function refaireJournal(
  tx: Tx,
  o: {
    userId: string
    bloc: string
    faits: Awaited<ReturnType<typeof lireFaits>>
    manifeste: Manifeste
    reglages: Reglages
    maintenant: string
  },
): Promise<void> {
  const lignes = lignesDuJournal(o.faits, {
    manifestes: { [o.manifeste.bloc]: o.manifeste },
    reglages: o.reglages,
  })
  await tx
    .delete(t.journal)
    .where(and(eq(t.journal.userId, o.userId), eq(t.journal.blocId, o.bloc)))
  if (lignes.length === 0) return
  await tx.insert(t.journal).values(
    lignes.map((ligne) => ({
      id: nouvelId(instantEnMs(o.maintenant)),
      userId: o.userId,
      blocId: o.bloc,
      type: ligne.type,
      donnees: ligne,
      versionMoteur: VERSION_MOTEUR,
      dateServeur: ligne.date,
    })),
  )
}
