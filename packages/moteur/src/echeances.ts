import type { Reglages } from '@janus/contrats'
import type { ResultatBloc } from './statut.ts'
import { ajouterJours, jourDe } from './temps.ts'
import type { Jour } from './temps.ts'

export type TypeEcheance = 'verification' | 'retest' | 'entretien'

/** Ce qui est dû et à partir de quel jour `AAAA-MM-JJ`. */
export interface Echeance {
  readonly type: TypeEcheance
  readonly genre: 'jour'
  readonly apres: Jour
}

/**
 * La prochaine échéance d'un bloc, ou `null` s'il n'y en a pas.
 * - vérification : « acquis provisoirement » + `delaiVerificationJours` jours ;
 * - retest : « acquis » + `delaiRetestJours` jours ; le retest réussi clôt le parcours ;
 * - après un échec (le dernier événement retenu), nouvel essai `delaiNouvelEssaiJours` jours plus tard.
 * Les jours sont ceux de `jourDe`.
 */
export function echeances(etat: ResultatBloc, reglages: Reglages): Echeance | null {
  const jour = (instant: string) => jourDe(instant, reglages.fuseau, reglages.heureBascule)
  const { acquisProvisoirement, acquis } = etat.dates
  const apresEchec = (normal: Jour): Jour =>
    etat.preuves.dernierEchec === null
      ? normal
      : ajouterJours(jour(etat.preuves.dernierEchec), reglages.delaiNouvelEssaiJours)
  const enJour = (type: TypeEcheance, normal: Jour): Echeance => ({
    type,
    genre: 'jour',
    apres: apresEchec(normal),
  })

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

/** Vrai quand le jour de l'échéance est atteint à `maintenant` (avec la bascule). */
export function estDue(echeance: Echeance, maintenant: string, reglages: Reglages): boolean {
  return jourDe(maintenant, reglages.fuseau, reglages.heureBascule) >= echeance.apres
}
