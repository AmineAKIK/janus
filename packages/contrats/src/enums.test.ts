import { describe, expect, it } from 'vitest'
import {
  Aide,
  Certitude,
  Confiance,
  FormeTransfert,
  Niveau,
  NoteCarte,
  RaisonNonCompte,
  Serie,
  Source,
  Statut,
  TypeDifferee,
  TypeVerification,
} from './enums.ts'

const ENUMERATIONS = [
  [
    'Statut',
    Statut,
    [
      'non_commence',
      'en_cours',
      'vu',
      'acquis_provisoirement',
      'acquis',
      'maitrise',
      'a_reprendre',
    ],
  ],
  ['Niveau', Niveau, ['solide', 'partiel', 'fragile', 'pas_encore']],
  ['Confiance', Confiance, ['sur', 'hesitant', 'hasard']],
  ['Serie', Serie, ['restitution', 'consolidation', 'rappel', 'verification']],
  ['TypeDifferee', TypeDifferee, ['explication', 'tache', 'transfert']],
  [
    'FormeTransfert',
    FormeTransfert,
    ['choisir_methode', 'adapter_condition', 'trouver_erreur', 'hors_champ'],
  ],
  ['Source', Source, ['support', 'deduit', 'ajoute']],
  ['Certitude', Certitude, ['sur', 'non_verifie']],
  ['RaisonNonCompte', RaisonNonCompte, ['relance', 'avec_support', 'recopiee', 'non_verifiee']],
  ['TypeVerification', TypeVerification, ['verification', 'retest', 'entretien']],
  ['NoteCarte', NoteCarte, ['a_revoir', 'difficile', 'bien', 'facile']],
] as const

describe('énumérations', () => {
  it.each(ENUMERATIONS)('%s expose exactement ses valeurs', (_nom, schema, valeurs) => {
    expect(schema.options).toEqual(valeurs)
  })

  it.each(ENUMERATIONS)('%s accepte chaque valeur et refuse le reste', (_nom, schema, valeurs) => {
    for (const valeur of valeurs) {
      expect(schema.parse(valeur)).toBe(valeur)
    }
    expect(schema.safeParse('inconnue').success).toBe(false)
    expect(schema.safeParse(null).success).toBe(false)
    expect(schema.safeParse(1).success).toBe(false)
  })
})

describe('Aide', () => {
  it.each([0, 1, 2, 3, 4])('accepte %i', (niveau) => {
    expect(Aide.parse(niveau)).toBe(niveau)
  })

  it.each([-1, 5, 1.5, '2', null])('refuse %j avec un message en français', (valeur) => {
    const resultat = Aide.safeParse(valeur)
    expect(resultat.success).toBe(false)
    expect(resultat.error?.issues[0]?.message).toBe(
      'Le niveau d’aide doit être un entier de 0 à 4.',
    )
  })
})
