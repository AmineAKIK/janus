import type {
  Aide,
  Confiance,
  Niveau,
  RaisonNonCompte,
  Serie,
  Statut,
  TypeDifferee,
  TypeVerification,
} from '@janus/contrats'

interface FaitDeBase {
  readonly id: string
  /** Code du bloc, par exemple `B02`. */
  readonly bloc: string
  /** Date donnée par le serveur, ISO 8601 UTC. Jamais l'heure du téléphone. */
  readonly date: string
}

/** Une réponse donnée pendant une vérification, un retest ou un entretien. */
export interface ReponseVerification {
  readonly type: TypeDifferee
  readonly question: string
  readonly tour: number
  /** Niveau de la correction, pour les questions d'explication et de transfert. */
  readonly niveau?: Niveau
  /** Résultat de la vérification automatique, pour les tâches. */
  readonly reussi?: boolean
  readonly compte: boolean
}

/** Tout ce que le serveur a enregistré sur un bloc. Le statut se recalcule toujours depuis ces faits. */
export type Fait = FaitDeBase &
  (
    | { readonly type: 'bloc_ouvert'; readonly horsPrerequis: boolean; readonly raison?: string }
    | { readonly type: 'etape_vue'; readonly etape: string }
    | {
        readonly type: 'pratique_resultat'
        readonly exercice: string
        readonly item: string
        readonly reussi: boolean
        readonly aide: Aide
      }
    | { readonly type: 'atelier_resultat'; readonly reussi: boolean; readonly aide: Aide }
    | { readonly type: 'aisance_resultat'; readonly reussi: boolean; readonly dureeS: number }
    | {
        readonly type: 'correction'
        readonly serie: Serie
        readonly question: string
        readonly tour: number
        readonly niveau: Niveau
        readonly compte: boolean
        readonly raisonNonCompte?: RaisonNonCompte
        readonly confiance: Confiance
        /** Erreurs repérées par l'IA : elles n'ouvrent rien tant qu'Amine ne les coche pas. */
        readonly erreursIa: readonly string[]
      }
    | {
        readonly type: 'verification_terminee'
        readonly verification: TypeVerification
        readonly valable: boolean
        readonly raisonInvalide?: string
        readonly reponses: readonly ReponseVerification[]
      }
    | {
        readonly type: 'erreur_cochee'
        readonly erreur: string
        readonly source: 'amine' | 'ia_confirmee'
      }
    | {
        readonly type: 'erreur_decochee'
        readonly erreur: string
        readonly source: 'amine' | 'ia_confirmee'
      }
    | { readonly type: 'statut_force'; readonly statut: Statut; readonly raison: string }
    | { readonly type: 'force_levee' }
  )
