import type { Certitude, RaisonNonCompte } from '@janus/contrats'

export interface EntreeCompte {
  /** 1 pour la première tentative, 2 et plus pour une relance. */
  readonly tour: number
  /** Le support a été collé dans la réponse. */
  readonly colle: boolean
  /** Le cours a été rouvert avant de répondre. */
  readonly retourCours: boolean
  readonly recopiee: boolean
  readonly certitude: Certitude
}

export type ResultatCompte =
  { readonly compte: true } | { readonly compte: false; readonly raison: RaisonNonCompte }

/** Dit si une réponse compte pour le statut, sinon pourquoi (première raison dans l'ordre de priorité). */
export function compte({
  tour,
  colle,
  retourCours,
  recopiee,
  certitude,
}: EntreeCompte): ResultatCompte {
  if (tour > 1) return { compte: false, raison: 'relance' }
  if (colle || retourCours) return { compte: false, raison: 'avec_support' }
  if (recopiee) return { compte: false, raison: 'recopiee' }
  if (certitude === 'non_verifie') return { compte: false, raison: 'non_verifiee' }
  return { compte: true }
}
