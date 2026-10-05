import { z } from 'zod'

export const Statut = z.enum([
  'non_commence',
  'en_cours',
  'vu',
  'acquis_provisoirement',
  'acquis',
  'maitrise',
  'a_reprendre',
])
export type Statut = z.infer<typeof Statut>

export const Niveau = z.enum(['solide', 'partiel', 'fragile', 'pas_encore'])
export type Niveau = z.infer<typeof Niveau>

export const Confiance = z.enum(['sur', 'hesitant', 'hasard'])
export type Confiance = z.infer<typeof Confiance>

export const Serie = z.enum(['restitution', 'consolidation', 'rappel', 'verification'])
export type Serie = z.infer<typeof Serie>

export const TypeDifferee = z.enum(['explication', 'tache', 'transfert'])
export type TypeDifferee = z.infer<typeof TypeDifferee>

export const FormeTransfert = z.enum([
  'choisir_methode',
  'adapter_condition',
  'trouver_erreur',
  'hors_champ',
])
export type FormeTransfert = z.infer<typeof FormeTransfert>

export const Source = z.enum(['support', 'deduit', 'ajoute'])
export type Source = z.infer<typeof Source>

export const Certitude = z.enum(['sur', 'non_verifie'])
export type Certitude = z.infer<typeof Certitude>

export const RaisonNonCompte = z.enum(['relance', 'avec_support', 'recopiee', 'non_verifiee'])
export type RaisonNonCompte = z.infer<typeof RaisonNonCompte>

export const TypeVerification = z.enum(['verification', 'retest', 'entretien'])
export type TypeVerification = z.infer<typeof TypeVerification>

export const NoteCarte = z.enum(['a_revoir', 'difficile', 'bien', 'facile'])
export type NoteCarte = z.infer<typeof NoteCarte>

/** Niveau d'aide : 0 aucune, 1 question qui oriente, 2 indice sur la notion, 3 étape détaillée, 4 solution complète. */
export const Aide = z.literal([0, 1, 2, 3, 4], {
  error: 'Le niveau d’aide doit être un entier de 0 à 4.',
})
export type Aide = z.infer<typeof Aide>
