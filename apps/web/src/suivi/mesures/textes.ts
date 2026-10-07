import type { Confiance } from '@janus/contrats'
import { texteJourCourt } from '../../revision/textes.ts'
import { nombreFrancais } from '../../parametres/textes.ts'

const nombre = (n: number, singulier: string, pluriel: string) =>
  `${String(n)} ${n < 2 ? singulier : pluriel}`

export const TEXTES_MESURES = {
  autonomie: 'Autonomie',
  autonomieSousTitre: 'Réponses correctes sans aide',
  autonomieVide: 'Pas encore d’exercice de pratique.',
  retention: 'Rétention',
  retentionSousTitre: 'Mesures par semaine, sans agrégat global',
  semaine: 'Semaine du',
  cartes: 'Cartes',
  questions: 'Questions de début',
  verifications: 'Vérifications',
  aucune: '–',
  calibration: 'Calibration',
  calibrationSousTitre: 'Confiance déclarée avant correction',
  confiance: 'Confiance',
  justes: 'Juste',
  faux: 'Faux',
  calibrationRegle: 'Une erreur en étant sûr vaut une révision.',
  aisance: 'Aisance',
  aisanceSousTitre: 'Temps observé face aux objectifs réels',
  nonRequis: 'non requis',
  aucunTemps: 'aucun temps',
} as const

export const LIBELLE_CONFIANCE: Readonly<Record<Confiance, string>> = {
  sur: 'Sûr',
  hesitant: 'Hésitant',
  hasard: 'Au hasard',
}

/** Du plus ancien au plus récent : « Il y a 3 semaines », « Il y a 2 semaines », « Semaine dernière », « Cette semaine ». */
export function libelleSemaine(rang: number, total: number): string {
  const ecart = total - 1 - rang
  if (ecart === 0) return 'Cette semaine'
  if (ecart === 1) return 'Semaine dernière'
  return `Il y a ${String(ecart)} semaines`
}

/** « 16 sept. » : le lundi d'une semaine, `AAAA-MM-JJ`. */
export const texteLundi = (debut: string) => texteJourCourt(debut)

/** « 8 · 80 % » : le total, puis la part réussie ; « – » sans rien. */
export const texteCartes = (reussis: number, total: number) =>
  total === 0 ? TEXTES_MESURES.aucune : `${String(total)} · ${pourcent(reussis / total)}`

/** « 4 sur 6 » : les réussis sur le total ; « – » sans rien. */
export const texteSur = (reussis: number, total: number) =>
  total === 0 ? TEXTES_MESURES.aucune : `${String(reussis)} sur ${String(total)}`

export const pourcent = (part: number) => `${String(Math.round(part * 100))} %`

export const textePhraseAutonomie = (maintenant: number, avant: number, libelleAvant: string) =>
  `${pourcent(maintenant)} sans aide cette semaine, contre ${pourcent(avant)} ${libelleAvant.toLowerCase()}`

export const texteAideMoyenne = (aide: number) =>
  `Aide moyenne cette semaine : ${nombreFrancais(aide, 1)}`

export const texteErreursSures = (n: number) => `Erreurs en étant sûr : ${String(n)} cette semaine`

export const texteMeilleur = (meilleurS: number | null, objectifS: number) =>
  `${meilleurS === null ? TEXTES_MESURES.aucunTemps : `${nombreFrancais(meilleurS, 0)} s`} · objectif ${String(objectifS)} s`

export const texteReussites = (reussites: number, requises: number, jours: number) =>
  `${nombre(reussites, 'réussite', 'réussites')} sur ${String(requises)}, sur ${nombre(jours, 'jour différent', 'jours différents')}`
