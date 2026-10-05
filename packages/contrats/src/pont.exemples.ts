import type { MessageAppli, MessagePage } from './pont.ts'

// Un exemple valide de chaque message du pont, pour les tests et pour la fiche de démonstration.

const commun = {
  id: '0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b',
  bloc: 'D01',
  version: 3,
  t: '2026-06-01T12:00:00+02:00',
} as const

export const EXEMPLES_PAGE = {
  'page.prete': { ...commun, type: 'page.prete', schema: 2 },
  'etape.vue': { ...commun, type: 'etape.vue', etape: 'ET3' },
  'pretest.reponse': {
    ...commun,
    type: 'pretest.reponse',
    question: 'P1',
    reponse: 'Je pense que c’est une liste.',
  },
  'pratique.resultat': {
    ...commun,
    type: 'pratique.resultat',
    exercice: 'PR1',
    item: 'PR1-2',
    reussi: true,
    aide: 0,
    essais: 2,
  },
  'atelier.resultat': {
    ...commun,
    type: 'atelier.resultat',
    reussi: true,
    predictions_justes: 3,
    aide: 1,
  },
  'aisance.resultat': { ...commun, type: 'aisance.resultat', reussi: true, duree_s: 42.5 },
  'restitution.demande': {
    ...commun,
    type: 'restitution.demande',
    serie: 'restitution',
    question: 'R1',
    reponse: 'Une fiche résume un seul bloc de cours.',
    confiance: 'sur',
    relance: '',
    support: { colle: false, retour_cours: false },
  },
  'bilan.erreurs': { ...commun, type: 'bilan.erreurs', ids: ['E1', 'E3'] },
  'etat.sauver': {
    ...commun,
    type: 'etat.sauver',
    etat: { etape: 'ET3', reponses: { R1: 'Une fiche résume un seul bloc.' } },
  },
  'correction.accord': {
    ...commun,
    type: 'correction.accord',
    correction: '0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2c',
    accord: true,
  },
} satisfies Record<MessagePage['type'], Record<string, unknown>>

export const EXEMPLES_APPLI = {
  'etat.init': {
    type: 'etat.init',
    bloc: 'D01',
    version: 3,
    etat: { etape: 'ET3' },
    statut: 'en_cours',
    serie_ouverte: { restitution: true, consolidation: false },
  },
  'restitution.correction': {
    type: 'restitution.correction',
    id: '0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2c',
    echantillon: false,
    question: 'R1',
    tour: 1,
    message: 'Presque : il manque la limite d’un seul bloc.',
    niveau: 'partiel',
    erreurs_critiques: ['E1'],
    source: 'support',
    ref: 'ET2',
    certitude: 'sur',
    compte: true,
  },
  'statut.maj': {
    type: 'statut.maj',
    statut: 'vu',
    manque: [{ code: 'consolidation_trop_tot', apres: '2026-06-01T11:30:00Z' }],
  },
  erreur: {
    type: 'erreur',
    code: 'plafond_atteint',
    detail: 'Le plafond mensuel de l’IA est atteint.',
    message_id: '0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b',
  },
  'etape.aller': { type: 'etape.aller', etape: 'ET7' },
} satisfies Record<MessageAppli['type'], Record<string, unknown>>
