import type { Confiance, TypeEtape } from '@janus/contrats'
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
  calibrationSousTitre: 'Depuis le début · confiance déclarée avant correction',
  confiance: 'Confiance',
  justes: 'Juste',
  faux: 'Faux',
  calibrationRegle: 'Une erreur en étant sûr vaut une révision.',
  aisance: 'Aisance',
  aisanceSousTitre: 'Temps observé face aux objectifs réels',
  nonRequis: 'non requis',
  aucunTemps: 'aucun temps',
  temps: 'Temps actif de la semaine',
  tempsSousTitre: 'Une mesure, jamais un objectif.',
  tempsVide: 'Pas encore de temps actif cette semaine.',
  lecture: 'Lecture',
  pratique: 'Pratique',
  restitution: 'Restitution',
  parBloc: 'Par bloc',
  revue: 'Revue de la méthode',
  revueSousTitre: 'Point de synthèse du module',
  revueFaite: 'Revue faite',
  revueATitre: 'Notions à reprendre plusieurs fois',
  revueEtapes: 'Étapes souvent sautées',
  fiabilite: 'Fiabilité de la correction IA',
  fiabiliteSousTitre: 'Contrôle humain et signalements',
  copiesRelues: 'Copies relues',
  desaccords: 'Désaccords',
  nonVerifiees: 'Réponses non vérifiées',
  contestations: 'Contestations',
  fiabiliteRegle: 'Une contestation ne change jamais le niveau.',
  alerteDesaccords: 'Le tuteur se trompe souvent : revois la consigne ou le modèle.',
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

/** Le résumé repliable des blocs dont on n'a encore rien mesuré. */
export const texteSansMesure = (n: number) => nombre(n, 'bloc sans mesure', 'blocs sans mesure')

export const texteReussites = (reussites: number, requises: number, jours: number) =>
  `${nombre(reussites, 'réussite', 'réussites')} sur ${String(requises)}, sur ${nombre(jours, 'jour distinct', 'jours distincts')}`

/** « 45 s », « 12 min », « 1 h 05 » : un temps actif en secondes. */
export function texteDuree(secondes: number): string {
  if (secondes < 60) return `${String(secondes)} s`
  const minutes = Math.round(secondes / 60)
  if (minutes < 60) return `${String(minutes)} min`
  return `${String(Math.floor(minutes / 60))} h ${String(minutes % 60).padStart(2, '0')}`
}

/** « 1 sur 4 » : les désaccords sur les copies relues ; « – » sans copie relue. */
export const texteDesaccords = (desaccords: number, relues: number) =>
  relues === 0 ? TEXTES_MESURES.aucune : `${String(desaccords)} sur ${String(relues)}`

export const LIBELLE_ETAPE: Readonly<Record<TypeEtape, string>> = {
  carte: 'Carte',
  pretest: 'Pré-test',
  explication: 'Explication',
  pratique: 'Pratique',
  atelier: 'Atelier',
  aisance: 'Aisance',
  restitution: 'Restitution',
  consolidation: 'Consolidation',
  bilan: 'Bilan',
}

export const texteProchaineRevue = (restants: number) =>
  `Prochaine revue après ${nombre(restants, 'bloc', 'blocs')}.`

export const texteBlocsVus = (n: number) =>
  `${nombre(n, 'bloc est passé', 'blocs sont passés')} à Vu depuis la dernière revue.`

/** « Temps actif depuis la dernière revue : 1 h 30, dont 33 % à pratiquer » ; sans temps, sans la part. */
export const texteTempsDeRevue = (tempsS: number, pratiqueS: number) =>
  tempsS === 0
    ? 'Pas encore de temps actif depuis la dernière revue.'
    : `Temps actif depuis la dernière revue : ${texteDuree(tempsS)}, dont ${pourcent(pratiqueS / tempsS)} à pratiquer`

export const texteNotion = (bloc: string, question: string, fois: number) =>
  `${bloc} · ${question} · ${String(fois)} fois`

export const texteEtapeSautee = (etape: TypeEtape, blocs: number) =>
  `${LIBELLE_ETAPE[etape]} · ${String(blocs)} blocs`
