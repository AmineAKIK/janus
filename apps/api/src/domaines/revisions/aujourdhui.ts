import type { Tache, TypeVerification } from '@janus/contrats'

/** Un report de vérification encore en vigueur : le bloc et le jour jusqu'où elle est reportée. */
export interface Report {
  readonly bloc: string
  readonly jusqua: string
}

/** Les blocs dont une vérification est reportée au-delà de ce jour : la file du jour ne les propose plus. */
export function blocsReportes(reports: readonly Report[], jour: string): ReadonlySet<string> {
  return new Set(reports.filter(({ jusqua }) => jusqua > jour).map(({ bloc }) => bloc))
}

/** Les tâches qui mènent à une vérification tirée par le serveur. */
export function estVerification(tache: Tache): tache is Tache & { type: TypeVerification } {
  return tache.type === 'verification' || tache.type === 'retest' || tache.type === 'entretien'
}

/**
 * Où mène une tâche. Une vérification mène à la page qui l'ouvre (`POST /verifications`) puis la
 * remplace par la vérification : la file du jour reste une lecture.
 */
export function lienDeLaTache(tache: Tache): string {
  switch (tache.type) {
    case 'reprendre_erreur':
      return tache.lien
    case 'questions_debut':
      return '/questions'
    case 'reprise':
      return `/blocs/${tache.blocs[0] ?? ''}`
    case 'verification':
    case 'retest':
    case 'entretien':
      return `/verifications/ouvrir/${tache.bloc}/${tache.type}`
    case 'cartes':
      return '/revision'
    case 'bloc':
      return `/blocs/${tache.bloc}`
  }
}
