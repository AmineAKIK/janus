import { describe, expect, it } from 'vitest'
import { correspond, grouper, lireFiltre } from './filtre.ts'

const blocs = [
  { bloc: 'B01', partie: 'P1 Machine', statut: 'acquis' },
  { bloc: 'B02', partie: 'P1 Machine', statut: 'a_reprendre' },
  { bloc: 'B03', partie: 'P2 Réseaux', statut: 'vu' },
  { bloc: 'B04', partie: 'P3 Poste', statut: 'maitrise' },
] as const

describe('lireFiltre', () => {
  it('connaît « à faire » et « à reprendre », le reste affiche tout', () => {
    expect(lireFiltre('a_faire')).toBe('a_faire')
    expect(lireFiltre('a_reprendre')).toBe('a_reprendre')
    expect(lireFiltre('n-importe-quoi')).toBe('tous')
    expect(lireFiltre(undefined)).toBe('tous')
  })
})

describe('correspond', () => {
  it('« à faire » garde tout ce qui n’est ni acquis ni maîtrisé', () => {
    expect(correspond('a_faire', 'acquis_provisoirement')).toBe(true)
    expect(correspond('a_faire', 'acquis')).toBe(false)
    expect(correspond('a_faire', 'maitrise')).toBe(false)
  })
})

describe('grouper', () => {
  it('regroupe par partie dans l’ordre, avec la plage de codes de la partie entière', () => {
    expect(grouper(blocs, 'tous').map(({ partie, plage }) => [partie, plage])).toEqual([
      ['P1 Machine', 'B01–B02'],
      ['P2 Réseaux', 'B03'],
      ['P3 Poste', 'B04'],
    ])
  })

  it('masque les parties vides et garde la plage de la partie entière', () => {
    const groupes = grouper(blocs, 'a_reprendre')

    expect(groupes).toHaveLength(1)
    expect(groupes[0]).toMatchObject({ partie: 'P1 Machine', plage: 'B01–B02' })
    expect(groupes[0]?.blocs.map(({ bloc }) => bloc)).toEqual(['B02'])
  })
})
