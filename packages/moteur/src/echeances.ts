import type { Reglages } from '@janus/contrats'
import type { ResultatBloc } from './statut.ts'
import { ajouterJours, instantEnIso, instantEnMs, jourDe, MS_PAR_MINUTE } from './temps.ts'
import type { Jour } from './temps.ts'

export type TypeEcheance = 'consolidation' | 'verification' | 'retest' | 'entretien'

/** Ce qui est dû et à partir de quand : un instant ISO (consolidation) ou un jour `AAAA-MM-JJ`. */
export type Echeance =
  | { readonly type: 'consolidation'; readonly genre: 'instant'; readonly apres: string }
  | {
      readonly type: Exclude<TypeEcheance, 'consolidation'>
      readonly genre: 'jour'
      readonly apres: Jour
    }

/**
 * La prochaine échéance d'un bloc, ou `null` s'il n'y en a pas.
 * - consolidation : dernière restitution + `delaiConsolidationMinutes` ;
 * - vérification : « acquis provisoirement » + `delaiVerificationJours` jours ;
 * - retest : « acquis » + `delaiRetestJours` jours ; le retest réussi clôt le parcours ;
 * - après un échec (le dernier événement retenu), nouvel essai `delaiNouvelEssaiJours` jours plus tard.
 * Les jours sont ceux de `jourDe`.
 */
export function echeances(etat: ResultatBloc, reglages: Reglages): Echeance | null {
  const jour = (instant: string) => jourDe(instant, reglages.fuseau, reglages.heureBascule)
  const { vu, acquisProvisoirement, acquis } = etat.dates
  const apresEchec = (normal: Jour): Jour =>
    etat.preuves.dernierEchec === null
      ? normal
      : ajouterJours(jour(etat.preuves.dernierEchec), reglages.delaiNouvelEssaiJours)
  const enJour = (type: Exclude<TypeEcheance, 'consolidation'>, normal: Jour): Echeance => ({
    type,
    genre: 'jour',
    apres: apresEchec(normal),
  })

  if (vu !== null && etat.manque.some(({ code }) => code.startsWith('consolidation_'))) {
    // Le manque connaît l'instant exact, y compris quand rouvrir le cours a relancé le délai.
    const tropTot = etat.manque.find(({ code }) => code === 'consolidation_trop_tot')
    return {
      type: 'consolidation',
      genre: 'instant',
      apres:
        tropTot?.apres ??
        instantEnIso(instantEnMs(vu) + reglages.delaiConsolidationMinutes * MS_PAR_MINUTE),
    }
  }
  if (acquisProvisoirement !== null && acquis === null) {
    return enJour(
      'verification',
      ajouterJours(jour(acquisProvisoirement), reglages.delaiVerificationJours),
    )
  }
  if (acquis !== null && etat.manque.some(({ code }) => code.startsWith('retest_'))) {
    return enJour('retest', ajouterJours(jour(acquis), reglages.delaiRetestJours))
  }
  // Le retest réussi clôt le parcours : plus rien n'est dû.
  return null
}

/** Vrai quand l'échéance est atteinte à `maintenant` : l'instant lui-même, ou le jour (avec la bascule). */
export function estDue(echeance: Echeance, maintenant: string, reglages: Reglages): boolean {
  return echeance.genre === 'instant'
    ? instantEnMs(maintenant) >= instantEnMs(echeance.apres)
    : jourDe(maintenant, reglages.fuseau, reglages.heureBascule) >= echeance.apres
}
