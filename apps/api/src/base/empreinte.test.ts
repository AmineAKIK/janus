import { describe, expect, it } from 'vitest'
import { empreinteJson, sha256Hex } from './empreinte.ts'

describe('sha256Hex', () => {
  it('rend le SHA-256 hexadécimal, d’un texte comme d’octets', () => {
    const attendu = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    expect(sha256Hex('abc')).toBe(attendu)
    expect(sha256Hex(new TextEncoder().encode('abc'))).toBe(attendu)
  })
})

describe('empreinteJson', () => {
  it('est le SHA-256 du JSON écrit, dans l’ordre des champs', () => {
    expect(empreinteJson({ a: 1, b: 2 })).toBe(sha256Hex('{"a":1,"b":2}'))
    expect(empreinteJson({ b: 2, a: 1 })).not.toBe(empreinteJson({ a: 1, b: 2 }))
  })
})
