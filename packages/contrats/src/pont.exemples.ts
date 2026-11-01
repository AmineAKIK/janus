import type { MessageAppli, MessagePage } from './pont.ts'

// Un exemple valide de chaque message du pont, pour les tests et pour la fiche de démonstration.

/** La pratique d'un bloc, telle que le serveur la rend : un item réussi avec de l'aide, puis refait. */
export const EXEMPLE_PRATIQUE = {
  aujourdhui: '2026-06-01',
  resultats: [
    {
      id: '0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2a',
      item: 'PR1-2',
      reussi: true,
      aide: 1,
      brute: true,
      jour: '2026-06-01',
      cas: 'origine',
    },
    {
      id: '0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b',
      item: 'PR1-2',
      reussi: true,
      aide: 0,
      brute: true,
      jour: '2026-06-01',
      cas: null,
    },
  ],
  expliques: [],
} as const

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
    cas: 'variante',
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
  'lien.ouvrir': { ...commun, type: 'lien.ouvrir', url: 'https://www.figma.com/design/' },
  'page.taille': { ...commun, type: 'page.taille', hauteur: 1840 },
  'page.haut': { ...commun, type: 'page.haut' },
  'correction.accord': {
    ...commun,
    type: 'correction.accord',
    correction: '0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2c',
    accord: true,
  },
} satisfies Record<MessagePage['type'], Record<string, unknown>>

/** Une correction rendue (premier tour, comptée), telle que la page et `POST /corrections` la reçoivent. */
export const EXEMPLE_CORRECTION = {
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
} as const

export const EXEMPLES_APPLI = {
  'etat.init': {
    type: 'etat.init',
    bloc: 'D01',
    version: 3,
    etat: { etape: 'ET3' },
    statut: 'en_cours',
    serie_ouverte: { restitution: true },
    aisance: [{ le: '2026-06-01T10:00:00Z', duree_s: 24.5 }],
    pratique: EXEMPLE_PRATIQUE,
    theme: 'sombre',
  },
  'restitution.correction': { type: 'restitution.correction', ...EXEMPLE_CORRECTION },
  'statut.maj': {
    type: 'statut.maj',
    statut: 'vu',
    manque: [{ code: 'pratique_aide', exercices: ['PR1'] }],
    pratique: EXEMPLE_PRATIQUE,
  },
  erreur: {
    type: 'erreur',
    code: 'plafond_atteint',
    detail: 'Le plafond mensuel de l’IA est atteint.',
    message_id: '0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b',
  },
  'etape.aller': { type: 'etape.aller', etape: 'ET7' },
  'erreur.rejetee': { type: 'erreur.rejetee', question: 'R1', erreur: 'E2' },
} satisfies Record<MessageAppli['type'], Record<string, unknown>>
