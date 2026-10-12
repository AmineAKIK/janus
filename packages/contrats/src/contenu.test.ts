import { describe, expect, it } from 'vitest'
import { canonique, memeContenu } from './contenu.ts'

describe('canonique et memeContenu', () => {
  it('range les champs par nom, à tous les niveaux et dans les tableaux', () => {
    const rangee = canonique({ b: 1, a: [{ d: 1, c: 2 }] })

    expect(JSON.stringify(rangee)).toBe('{"a":[{"c":2,"d":1}],"b":1}')
  })

  it('compare le contenu sans tenir compte de l’ordre des champs', () => {
    expect(memeContenu({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 })).toBe(true)
    expect(memeContenu({ a: 1 }, { a: 2 })).toBe(false)
    expect(memeContenu([1, 2], [2, 1])).toBe(false)
    expect(memeContenu(null, 'x')).toBe(false)
  })
})
