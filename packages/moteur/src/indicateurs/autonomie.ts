import type { Reglages } from '@janus/contrats'
import type { Fait } from '../faits.ts'
import type { Jour } from '../temps.ts'
import { dernieresSemaines, semaineDe } from './semaines.ts'

export const SEMAINES_AUTONOMIE = 4

export interface SemaineAutonomie {
  /** Le lundi de la semaine. */
  readonly debut: Jour
  /** Les items de pratique réussis à l'aide 0. */
  readonly sansAide: number
  /** Tous les items de pratique de la semaine. */
  readonly total: number
  /** La part réussie sans aide, entre 0 et 1 ; `null` sans item cette semaine-là. */
  readonly part: number | null
}

export interface Autonomie {
  /** Les 4 dernières semaines, la plus ancienne d'abord. */
  readonly semaines: readonly SemaineAutonomie[]
  /** Le niveau d'aide moyen (0 à 4) des items de la semaine courante ; `null` sans item. */
  readonly aideMoyenne: number | null
}

/** « Réponses correctes sans aide » : la part des items de pratique réussis à l'aide 0, par semaine. */
export function autonomie(
  faits: readonly Fait[],
  maintenant: string,
  reglages: Pick<Reglages, 'fuseau' | 'heureBascule'>,
): Autonomie {
  const semaines = dernieresSemaines(maintenant, reglages, SEMAINES_AUTONOMIE).map((debut) => ({
    debut,
    sansAide: 0,
    total: 0,
  }))
  const parDebut = new Map(semaines.map((semaine) => [semaine.debut, semaine]))
  const courante = semaineDe(maintenant, reglages)
  let aides = 0
  let itemsCourants = 0
  for (const fait of faits) {
    if (fait.type !== 'pratique_resultat') continue
    const debut = semaineDe(fait.date, reglages)
    const semaine = parDebut.get(debut)
    if (semaine === undefined) continue
    semaine.total += 1
    if (fait.reussi && fait.aide === 0) semaine.sansAide += 1
    if (debut === courante) {
      aides += fait.aide
      itemsCourants += 1
    }
  }
  return {
    semaines: semaines.map((semaine) => ({
      ...semaine,
      part: semaine.total === 0 ? null : semaine.sansAide / semaine.total,
    })),
    aideMoyenne: itemsCourants === 0 ? null : aides / itemsCourants,
  }
}
