import { describe, expect, it } from 'vitest'
import { accorder, compter, statutGlobal } from './calculs.ts'

describe('compter', () => {
  it('compte « acquis » et « maîtrisé » comme acquis, pas « acquis provisoirement »', () => {
    expect(compter(['acquis', 'maitrise', 'acquis_provisoirement', 'vu', 'non_commence'])).toEqual({
      total: 5,
      ouverts: 4,
      acquis: 2,
    })
  })

  it('rend zéro partout pour une liste vide', () => {
    expect(compter([])).toEqual({ total: 0, ouverts: 0, acquis: 0 })
  })
})

describe('statutGlobal', () => {
  it('est « en cours » dès qu’un bloc est commencé', () => {
    expect(statutGlobal(['non_commence', 'vu'])).toBe('en_cours')
    expect(statutGlobal(['non_commence'])).toBe('non_commence')
    expect(statutGlobal([])).toBe('non_commence')
  })
})

describe('accorder', () => {
  it('garde le singulier à 0 et à 1', () => {
    expect(accorder(0, 'bloc', 'blocs')).toBe('0 bloc')
    expect(accorder(1, 'bloc', 'blocs')).toBe('1 bloc')
    expect(accorder(2, 'bloc', 'blocs')).toBe('2 blocs')
  })
})
