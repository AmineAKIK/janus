import { describe, expect, it } from 'vitest'
import { Reglages } from './reglages.ts'

const DEFAUTS = {
  fuseau: 'Europe/Paris',
  heureBascule: 4,
  delaiConsolidationMinutes: 60,
  delaiVerificationJours: 3,
  delaiRetestJours: 30,
  entretienMois: [3, 6, 12],
  delaiNouvelEssaiJours: 2,
  echecsAvantDescente: 2,
  seuilConsolidation: 0.8,
  questionsDebut: 6,
  nouvellesCartesParJour: 20,
  retentionVisee: 0.9,
  heuresSansPageAvantVerification: 24,
  joursAvantReutilisation: 60,
  seuilRecopie: 0.5,
  relancesMax: 4,
  caracteresReponseMax: 2000,
  echantillonControle: 10,
  seuilDesaccord: 0.15,
  plafondIaMillioniemes: 10_000_000,
  appelsIaParHeure: 60,
  heureRappel: '19:00',
  rappelsEnPauseJusquAu: null,
  blocsEntreRevues: 3,
}

// [clé, plus petite valeur permise, plus grande valeur permise]
const BORNES = [
  ['heureBascule', 0, 6],
  ['delaiConsolidationMinutes', 30, 1440],
  ['delaiVerificationJours', 1, 14],
  ['delaiRetestJours', 14, 90],
  ['delaiNouvelEssaiJours', 1, 7],
  ['echecsAvantDescente', 1, 5],
  ['seuilConsolidation', 0.5, 1],
  ['questionsDebut', 5, 10],
  ['nouvellesCartesParJour', 0, 100],
  ['retentionVisee', 0.8, 0.97],
  ['relancesMax', 0, 4],
  ['plafondIaMillioniemes', 0, 100_000_000],
  ['appelsIaParHeure', 1, 120],
  ['blocsEntreRevues', 3, 4],
] as const

function ecart(valeur: number): number {
  return valeur < 1 ? 0.01 : 1
}

describe('Reglages', () => {
  it('rend tous les défauts pour un objet vide', () => {
    expect(Reglages.parse({})).toEqual(DEFAUTS)
  })

  it('garde les valeurs fournies et complète les autres', () => {
    const reglages = Reglages.parse({ heureBascule: 5, heureRappel: '08:30' })
    expect(reglages.heureBascule).toBe(5)
    expect(reglages.heureRappel).toBe('08:30')
    expect(reglages.questionsDebut).toBe(6)
  })

  it('accepte une date de pause des rappels', () => {
    const reglages = Reglages.parse({ rappelsEnPauseJusquAu: '2026-12-31T00:00:00Z' })
    expect(reglages.rappelsEnPauseJusquAu).toBe('2026-12-31T00:00:00Z')
  })

  it('refuse un type incorrect pour les clés sans bornes', () => {
    expect(Reglages.safeParse({ fuseau: 3 }).success).toBe(false)
    expect(Reglages.safeParse({ caracteresReponseMax: '2000' }).success).toBe(false)
    expect(Reglages.safeParse({ entretienMois: 'trois' }).success).toBe(false)
  })

  describe.each(BORNES)('%s', (cle, min, max) => {
    it('accepte les deux bornes', () => {
      expect(Reglages.parse({ [cle]: min })[cle]).toBe(min)
      expect(Reglages.parse({ [cle]: max })[cle]).toBe(max)
    })

    it('refuse juste en dessous et juste au-dessus, avec un message en français', () => {
      for (const valeur of [min - ecart(min), max + ecart(max)]) {
        const resultat = Reglages.safeParse({ [cle]: valeur })
        expect(resultat.success).toBe(false)
        const message = resultat.error?.issues[0]?.message ?? ''
        expect(message).toMatch(/ doit être (un entier|un nombre) entre .+ et .+\.$/)
      }
    })

    it('refuse un texte', () => {
      expect(Reglages.safeParse({ [cle]: 'abc' }).success).toBe(false)
    })
  })

  it('refuse un nombre décimal pour un entier', () => {
    expect(Reglages.safeParse({ questionsDebut: 6.5 }).success).toBe(false)
  })

  it('écrit les bornes décimales avec une virgule', () => {
    const resultat = Reglages.safeParse({ seuilConsolidation: 0.2 })
    expect(resultat.error?.issues[0]?.message).toBe(
      'Le seuil de consolidation doit être un nombre entre 0,5 et 1.',
    )
  })
})
