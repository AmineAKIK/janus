import type { Confiance, Niveau } from '@janus/contrats'
import { accorder } from '../catalogue/calculs.ts'

export const TEXTES_QUESTIONS = {
  titre: 'Questions',
  suiteDuTitre: ' de début de séance',
  quitter: 'Quitter',
  confiance: 'Ta confiance avant de répondre',
  reponse: 'Ta réponse',
  aide: 'Écris ta réponse sans consulter le cours.',
  corriger: 'Faire corriger',
  jeNeSaisPas: 'Je ne sais pas',
  attente: 'Le tuteur lit ta réponse…',
  indisponible: 'Correction indisponible pour l’instant. Ta réponse est gardée.',
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
  etapeSuivante: 'Étape suivante',
  retourAujourdhui: 'Retour à Aujourd’hui',
  dialogueTitre: 'Quitter la séance ?',
  reprendrePlusTard: 'Reprendre plus tard',
  continuer: 'Continuer',
} as const

export const LIBELLES_CONFIANCE: Record<Confiance, string> = {
  sur: 'sûr',
  hesitant: 'hésitant',
  hasard: 'au hasard',
}

export const texteRang = (rang: number, total: number) => `${String(rang)} sur ${String(total)}`

export const texteNiveauEtConfiance = (niveau: string, confiance: Confiance) =>
  `${niveau} · tu étais ${LIBELLES_CONFIANCE[confiance]}`

export const texteSource = (bloc: string, ref: string) => `Source · Fiche ${bloc} · ${ref}`

export const texteVenaitDe = (bloc: string, titre: string) => `Venait de ${bloc} ${titre}`

export const texteQuestionsFaites = (nombre: number) =>
  accorder(nombre, 'question faite', 'questions faites')

export const texteReprise = (rang: number) =>
  `Tes réponses sont gardées. Tu pourras reprendre à la question ${String(rang)}.`

export const texteEtapeSuivante = (tache: string) => `Étape suivante : ${tache}`

/** L'énoncé tronqué à 48 caractères, avec « … » quand il est plus long. */
export function tronquer(texte: string, max = 48): string {
  return texte.length <= max ? texte : `${texte.slice(0, max)}…`
}

export const LIBELLES_NIVEAU_BILAN: Record<Niveau | 'a_verifier', string> = {
  solide: 'Solide',
  partiel: 'Partiel',
  fragile: 'Fragile',
  pas_encore: 'Pas encore',
  a_verifier: 'À vérifier',
}
