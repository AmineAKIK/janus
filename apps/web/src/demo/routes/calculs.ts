import type { EtatDemo, Manque as ManqueContrat, StatutBloc, Statut } from '@janus/contrats'
import { accesBloc, calculerBloc } from '@janus/moteur'
import type { ResultatBloc } from '@janus/moteur'
import { MANIFESTES_GRAINE } from '../graine.ts'

/** Les faits d'un bloc, tels que le store les a gardés. */
export const faitsDuBloc = (etat: EtatDemo, bloc: string) =>
  etat.faits.filter((fait) => fait.bloc === bloc)

/** Le statut d'un bloc, toujours recalculé par le moteur depuis ses faits, jamais écrit à la main. */
export function resultatDuBloc(etat: EtatDemo, bloc: string, maintenant: string): ResultatBloc {
  const manifeste = MANIFESTES_GRAINE[bloc]
  if (manifeste === undefined) throw new Error(`Bloc inconnu : ${bloc}`)
  return calculerBloc(faitsDuBloc(etat, bloc), manifeste, etat.reglages, maintenant)
}

/** Le statut que l'API rend après un fait : le statut, ce qui manque, les erreurs ouvertes. */
export function statutBloc(resultat: ResultatBloc): StatutBloc {
  return {
    statut: resultat.statut,
    manque: resultat.manque.map((manque): ManqueContrat => ({
      code: manque.code,
      ...(manque.questions === undefined ? {} : { questions: [...manque.questions] }),
      ...(manque.exercices === undefined ? {} : { exercices: [...manque.exercices] }),
      ...(manque.erreurs === undefined ? {} : { erreurs: [...manque.erreurs] }),
      ...(manque.apres === undefined ? {} : { apres: manque.apres }),
      ...(manque.points === undefined ? {} : { points: manque.points }),
      ...(manque.requis === undefined ? {} : { requis: manque.requis }),
    })),
    erreurs_ouvertes: [...resultat.erreursOuvertes],
  }
}

/** Libre si tous les prérequis du bloc sont au moins « acquis provisoirement », sinon une raison est exigée. */
export function accesDuBloc(etat: EtatDemo, bloc: string, maintenant: string) {
  const prerequis = MANIFESTES_GRAINE[bloc]?.prerequis ?? []
  const statuts: Statut[] = prerequis.map((code) => resultatDuBloc(etat, code, maintenant).statut)
  return accesBloc(statuts)
}
