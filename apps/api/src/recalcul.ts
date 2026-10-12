import { Manifeste, Reglages, StatutBloc } from '@janus/contrats'
import type { StatutBloc as StatutBlocApi } from '@janus/contrats'
import { calculerBloc, debutDuJour, echeances, VERSION_MOTEUR } from '@janus/moteur'
import type { Echeance } from '@janus/moteur'
import type { ResultatBloc } from '@janus/moteur'
import { maintenantDuBloc } from './base/axeTemps.ts'
import { lireFaits } from './base/faits.ts'
import { nouvelId } from '@janus/contrats'
import { instantEnMs } from '@janus/moteur'
import {
  ajouterEcheance,
  cloreEcheance,
  contexteDeRecalcul,
  echeancesEnCours,
  ecrireStatutCourant,
  majEcheance,
  statutsPerimes,
} from './base/statuts.ts'
import { verrouBloc } from './base/transaction.ts'
import type { Base } from './base/base.ts'
import type { Tx } from './base/transaction.ts'
import type { Horloge } from './horloge.ts'

export { VERSION_MOTEUR }

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
  await ecrireStatutCourant(tx, {
    userId,
    blocId: bloc.id,
    statutCalcule: resultat.statutCalcule,
    detail,
    versionMoteur: VERSION_MOTEUR,
    calculeLe: maintenant,
  })
  const echeance = echeances(resultat, reglages)
  await rangerEcheance(tx, { userId, blocId: bloc.id, echeance, reglages, maintenant })
  return resultat
}

/**
 * Recalcule les blocs dont les lignes calculées viennent d'une autre version des règles du moteur,
 * un bloc par transaction. Rend le nombre de blocs recalculés.
 */
export async function recalculerLesPerimes(base: Base, horloge: Horloge): Promise<number> {
  const perimes = await statutsPerimes(base.db, VERSION_MOTEUR)
  for (const { userId, blocId } of perimes) {
    await base.enTransaction(async (tx) => {
      const contexte = await contexteDeRecalcul(tx, userId, blocId)
      if (contexte === undefined) return
      await recalculer(tx, {
        userId,
        bloc: contexte.bloc,
        manifeste: Manifeste.parse(contexte.manifeste),
        reglages: Reglages.parse(contexte.reglages),
        maintenant: await maintenantDuBloc(tx, horloge, userId, blocId),
      })
    })
  }
  return perimes.length
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
  const enCours = await echeancesEnCours(tx, o.userId, o.blocId)
  const memeType = enCours.find(({ type }) => type === o.echeance?.type)
  for (const { id } of enCours.filter(({ id }) => id !== memeType?.id)) {
    await cloreEcheance(tx, id, o.maintenant)
  }
  if (o.echeance === null) return
  const valeurs = {
    genre: o.echeance.genre,
    dueLe: dueLe(o.echeance, o.reglages),
    versionMoteur: VERSION_MOTEUR,
  }
  if (memeType === undefined) {
    await ajouterEcheance(tx, {
      id: nouvelId(instantEnMs(o.maintenant)),
      userId: o.userId,
      blocId: o.blocId,
      type: o.echeance.type,
      ...valeurs,
    })
  } else {
    await majEcheance(tx, memeType.id, valeurs)
  }
}
