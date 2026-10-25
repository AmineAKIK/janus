import { describe, expect, it } from 'vitest'
import { etapesEnMots } from './etapesEnMots.ts'

const etapes = [
  { id: 'ET3', titre: 'À l’intuition' },
  { id: 'ET4', titre: 'Vrai ou faux' },
  { id: 'ET5', titre: 'NON, ET, OU' },
  { id: 'ET6', titre: 'L’ordre de calcul' },
]

describe('etapesEnMots', () => {
  it('nomme l’onglet à la place du numéro', () => {
    expect(etapesEnMots('Déduit de l’étape 6.', etapes)).toBe(
      'Déduit de l’étape « L’ordre de calcul ».',
    )
  })

  it('nomme chaque onglet d’une liste et d’un intervalle', () => {
    expect(etapesEnMots('Déduit des étapes 4 et 6.', etapes)).toBe(
      'Déduit des étapes « Vrai ou faux » et « L’ordre de calcul ».',
    )
    expect(etapesEnMots('les étapes 3 à 5', etapes)).toBe(
      'les étapes « À l’intuition », « Vrai ou faux » et « NON, ET, OU »',
    )
  })

  it('laisse un numéro sans étape au manifeste, et les mots qui ne sont pas une étape', () => {
    expect(etapesEnMots('les étapes 3 à 9', etapes)).toBe('les étapes 3 à 9')
    expect(etapesEnMots('des métapes 3', etapes)).toBe('des métapes 3')
  })

  it('nomme une erreur critique par son libellé, pas par son code', () => {
    const erreurs = [{ id: 'E4', libelle: 'Lire les poids à l’envers' }]
    expect(etapesEnMots('on trouverait 170 : c’est l’erreur E4.', etapes, erreurs)).toBe(
      'on trouverait 170 : c’est l’erreur « Lire les poids à l’envers ».',
    )
    expect(etapesEnMots('c’est l’erreur E9.', etapes, erreurs)).toBe('c’est l’erreur E9.')
  })
})
