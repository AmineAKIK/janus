import { Reglages, StatutBloc } from '@janus/contrats'
import type { Manifeste, StatutBloc as StatutBlocApi } from '@janus/contrats'
import { calculerBloc } from '@janus/moteur'
import type { ResultatBloc } from '@janus/moteur'
import { sql } from 'drizzle-orm'
import { lireFaits } from './base/faits.ts'
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
  return resultat
}
