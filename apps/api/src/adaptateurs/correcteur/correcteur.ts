import type { Confiance } from '@janus/contrats'

/** Un échange précédent d'une relance : ce que l'apprenant a écrit et ce que le tuteur a répondu. */
export interface TourPrecedent {
  readonly reponse: string
  readonly message: string
}

/** Tout ce que le correcteur lit pour une réponse. Chaque adaptateur le met en forme à sa façon. */
export interface RequeteCorrection {
  readonly titre: string
  /** Le cours du bloc (`contexte_ia`). */
  readonly contexteIa: string
  /** Les sources du cours : identifiant et référence. */
  readonly sources: readonly { readonly id: string; readonly ref: string }[]
  /** Les erreurs critiques du bloc : identifiant et texte. */
  readonly erreursCritiques: readonly { readonly id: string; readonly texte: string }[]
  readonly question: string
  readonly attendu: string
  readonly confiance: Confiance
  /** La réponse de l'apprenant, 2000 caractères au plus. */
  readonly reponse: string
  /** Les tours déjà joués sur cette question, dans l'ordre : vide au premier tour. */
  readonly historique: readonly TourPrecedent[]
  /** Vrai au second essai : la demande ajoute « Réponds uniquement avec le JSON demandé ». */
  readonly strict: boolean
}

/** Ce que le fournisseur a rendu, avant toute validation. */
export interface ResultatBrut {
  /** Le texte reçu, tel quel (il doit contenir un JSON). */
  readonly texte: string
  readonly modele: string
  readonly parametres: Readonly<Record<string, string | number>>
  readonly jetonsEntree: number
  /** La part de `jetonsEntree` servie par le cache de préfixe du fournisseur. */
  readonly jetonsEntreeCache: number
  readonly jetonsSortie: number
}

export interface Correcteur {
  readonly corriger: (requete: RequeteCorrection) => Promise<ResultatBrut>
}

/** Le fournisseur n'a pas répondu (réseau, délai, statut d'erreur, réponse illisible). */
export class ErreurCorrecteur extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'ErreurCorrecteur'
  }
}
