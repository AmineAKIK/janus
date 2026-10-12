import { afterEach, describe, expect, it, vi } from 'vitest'
import { dejaOuvert, marquerOuvert } from './ouvertures.ts'

afterEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
})

describe('ouvertures de la session', () => {
  it('se souvient des blocs ouverts, sans doublon', () => {
    expect(dejaOuvert('B03')).toBe(false)
    marquerOuvert('B03')
    marquerOuvert('B03')
    expect(dejaOuvert('B03')).toBe(true)
    expect(dejaOuvert('B04')).toBe(false)
    expect(JSON.parse(sessionStorage.getItem('janus.blocs-ouverts') ?? '[]')).toEqual(['B03'])
  })

  it('ignore un contenu abîmé', () => {
    sessionStorage.setItem('janus.blocs-ouverts', '{pas du json')
    expect(dejaOuvert('B03')).toBe(false)
    sessionStorage.setItem('janus.blocs-ouverts', '{"a":1}')
    expect(dejaOuvert('B03')).toBe(false)
  })

  it('continue sans stockage de session', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('plein')
    })
    expect(() => {
      marquerOuvert('B03')
    }).not.toThrow()
  })
})
