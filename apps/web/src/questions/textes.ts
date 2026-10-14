import type { Confiance } from '@janus/contrats'
import { accorder } from '../catalogue/calculs.ts'

/** La réponse enregistrée quand l'élève passe : l'écran de correction la reconnaît à ce texte. */
export const JE_NE_SAIS_PAS = 'Je ne sais pas'

export const TEXTES_QUESTIONS = {
  titre: 'Questions',
  suiteDuTitre: ' de début de séance',
  confiance: 'Ta confiance avant de répondre',
  reponse: 'Ta réponse',
  aide: 'Écris ta réponse sans consulter le cours.',
  corriger: 'Faire corriger',
  manqueConfiance: 'Choisis ton niveau de confiance.',
  manqueReponse: 'Écris ta réponse.',
  jeNeSaisPas: 'Je ne sais pas',
  attente: 'Le tuteur lit ta réponse…',
  indisponible: 'Correction indisponible pour l’instant. Ta réponse est gardée.',
  plafond:
    'Tu as atteint le plafond de corrections pour le moment. Ta réponse est gardée, réessaie dans quelques minutes.',
  relanceIndisponible: 'Le tuteur n’a pas pu répondre. Réessaie dans un instant.',
  relancePlafond: 'Plafond de corrections atteint : réessaie dans quelques minutes.',
  reessayer: 'Réessayer',
  suivante: 'Question suivante',
  voirBilan: 'Voir le bilan',
  indice: 'Indice',
  tuAsChoisi: 'Tu as choisi « Je ne sais pas ».',
  tuEtaisSur: 'Tu étais sûr : cette question reviendra plus tôt.',
  nonVerifiee: 'Le tuteur n’est pas sûr. Tu trancheras dans le bilan.',
  aVerifier: 'À vérifier',
  chargement: 'Chargement…',
  erreur: 'Impossible de charger cet écran.',
  aucune: 'Aucune question aujourd’hui.',
  legendeSure: '⚠ Erreur en étant sûr',
  dialogueTitre: 'Quitter la séance ?',
  reprendrePlusTard: 'Reprendre plus tard',
  accordQuestion: 'D’accord avec ce niveau ?',
  oui: 'Oui',
  non: 'Non',
  repondreAuTuteur: 'Répondre au tuteur',
  reponseAuTuteur: 'Ta réponse au tuteur',
  noteRelance: 'Les échanges avec le tuteur servent à apprendre et ne comptent pas comme preuve.',
  envoyerAuTuteur: 'Envoyer au tuteur',
  pasDAccord: 'Je ne suis pas d’accord',
  pourAllerPlusLoin: 'Pour aller plus loin, parles-en dans le projet Claude.',
} as const

const LIBELLES_CONFIANCE: Record<Confiance, string> = {
  sur: 'sûr',
  hesitant: 'hésitant',
  hasard: 'au hasard',
}

export const texteRang = (rang: number, total: number) => `${String(rang)} sur ${String(total)}`

export const texteNiveauEtConfiance = (niveau: string, confiance: Confiance) =>
  `${niveau} · tu étais ${LIBELLES_CONFIANCE[confiance]}`

export const texteSource = (bloc: string, ref: string) => `Source · Fiche ${bloc} · ${ref}`

/** Une correction rendue par le tuteur de secours : Amine doit le voir, pas croire que c'est Haiku. */
export const texteTuteurDeSecours = (modele: string) =>
  `Corrigé par le tuteur de secours (${modele}), pas par le tuteur habituel.`

export const texteVenaitDe = (bloc: string, titre: string) => `Venait de ${bloc} ${titre}`

export const texteQuestionsFaites = (nombre: number) =>
  accorder(nombre, 'question faite', 'questions faites')

export const texteReprise = (rang: number) =>
  `Tes réponses sont gardées. Tu pourras reprendre à la question ${String(rang)}.`

/** L'énoncé tronqué à 48 caractères, avec « … » quand il est plus long. */
export function tronquer(texte: string, max = 48): string {
  return texte.length <= max ? texte : `${texte.slice(0, max)}…`
}
