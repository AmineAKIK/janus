import type { NoteCarte, Reglages } from '@janus/contrats'
import type { Fait, ReponseVerification } from '../faits.ts'
import type { Jour } from '../temps.ts'
import { dernieresSemaines, semaineDe } from './semaines.ts'

export const SEMAINES_RETENTION = 4

/** Une carte notée : de quoi compter les revues par semaine. */
export interface RevueCarte {
  readonly date: string
  readonly note: NoteCarte
}

export interface Rapport {
  /** Les cartes sues, les questions solides, les vérifications réussies. */
  readonly reussis: number
  readonly total: number
}

export interface SemaineRetention {
  /** Le lundi de la semaine. */
  readonly debut: Jour
  /** Cartes revues ; sues = notées autrement que « À revoir ». */
  readonly cartes: Rapport
  /** Questions de début de séance, au premier tour ; solides = niveau solide. */
  readonly questions: Rapport
  /** Vérifications valables ; réussie = toutes ses réponses comptées, au premier tour, sont réussies. */
  readonly verifications: Rapport
}

/** Une réponse réussie : tâche réussie, ou explication et transfert au niveau solide. */
const reussie = (reponse: ReponseVerification) =>
  reponse.type === 'tache' ? reponse.reussi === true : reponse.niveau === 'solide'

/**
 * Ce qui reste retenu, semaine par semaine et sans total global : les cartes, les questions de
 * début de séance et les vérifications des 4 dernières semaines, la plus ancienne d'abord.
 */
export function retention(
  faits: readonly Fait[],
  revues: readonly RevueCarte[],
  maintenant: string,
  reglages: Pick<Reglages, 'fuseau' | 'heureBascule'>,
): readonly SemaineRetention[] {
  const vide = (): Rapport => ({ reussis: 0, total: 0 })
  const semaines = dernieresSemaines(maintenant, reglages, SEMAINES_RETENTION).map((debut) => ({
    debut,
    cartes: vide(),
    questions: vide(),
    verifications: vide(),
  }))
  const parDebut = new Map(semaines.map((semaine) => [semaine.debut, semaine]))
  const compter = (rapport: { reussis: number; total: number }, ok: boolean) => {
    rapport.total += 1
    if (ok) rapport.reussis += 1
  }

  for (const { date, note } of revues) {
    const semaine = parDebut.get(semaineDe(date, reglages))
    if (semaine !== undefined) compter(semaine.cartes, note !== 'a_revoir')
  }
  for (const fait of faits) {
    const semaine = parDebut.get(semaineDe(fait.date, reglages))
    if (semaine === undefined) continue
    if (fait.type === 'correction' && fait.serie === 'rappel' && fait.tour === 1) {
      compter(semaine.questions, fait.niveau === 'solide')
    }
    if (fait.type === 'verification_terminee' && fait.valable) {
      const comptees = fait.reponses.filter(({ compte, tour }) => compte && tour === 1)
      if (comptees.length > 0) compter(semaine.verifications, comptees.every(reussie))
    }
  }
  return semaines
}
