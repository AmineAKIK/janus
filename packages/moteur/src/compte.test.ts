import { describe, expect, it } from 'vitest'
import { compte } from './compte.ts'

const propre = {
  tour: 1,
  colle: false,
  retourCours: false,
  recopiee: false,
  certitude: 'sur',
} as const

describe('compte', () => {
  it('compte une réponse faite seul, au premier tour, vérifiée', () => {
    expect(compte(propre)).toEqual({ compte: true })
  })

  it('ne compte pas une relance', () => {
    expect(compte({ ...propre, tour: 2 })).toEqual({ compte: false, raison: 'relance' })
    expect(compte({ ...propre, tour: 5 })).toEqual({ compte: false, raison: 'relance' })
  })

  it('ne compte pas une réponse faite avec le support collé', () => {
    expect(compte({ ...propre, colle: true })).toEqual({ compte: false, raison: 'avec_support' })
  })

  it('ne compte pas une réponse faite après un retour au cours', () => {
    expect(compte({ ...propre, retourCours: true })).toEqual({
      compte: false,
      raison: 'avec_support',
    })
  })

  it('ne compte pas une réponse recopiée', () => {
    expect(compte({ ...propre, recopiee: true })).toEqual({ compte: false, raison: 'recopiee' })
  })

  it('ne compte pas une réponse non vérifiée', () => {
    expect(compte({ ...propre, certitude: 'non_verifie' })).toEqual({
      compte: false,
      raison: 'non_verifiee',
    })
  })

  describe('priorité des raisons', () => {
    const tout = {
      tour: 2,
      colle: true,
      retourCours: true,
      recopiee: true,
      certitude: 'non_verifie',
    } as const

    it('relance passe avant tout', () => {
      expect(compte(tout)).toEqual({ compte: false, raison: 'relance' })
    })

    it('avec_support passe avant recopiee et non_verifiee', () => {
      expect(compte({ ...tout, tour: 1 })).toEqual({ compte: false, raison: 'avec_support' })
    })

    it('recopiee passe avant non_verifiee', () => {
      expect(compte({ ...tout, tour: 1, colle: false, retourCours: false })).toEqual({
        compte: false,
        raison: 'recopiee',
      })
    })
  })
})
