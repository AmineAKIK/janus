import { describe, expect, it } from 'vitest'
import { CacheBorne } from './cacheBorne.ts'

describe('CacheBorne', () => {
  it('rend ce qui a été écrit, et rien pour une clé inconnue', () => {
    const cache = new CacheBorne<number>(3)
    cache.ecrire('a', 1)
    cache.ecrire('b', 2)
    expect(cache.lire('a')).toBe(1)
    expect(cache.lire('b')).toBe(2)
    expect(cache.lire('c')).toBeUndefined()
  })

  it('remplace la valeur d’une clé déjà écrite', () => {
    const cache = new CacheBorne<number>(3)
    cache.ecrire('a', 1)
    cache.ecrire('a', 2)
    expect(cache.lire('a')).toBe(2)
  })

  it('oublie tout en atteignant sa capacité, puis continue de servir', () => {
    const cache = new CacheBorne<number>(2)
    cache.ecrire('a', 1)
    cache.ecrire('b', 2)
    cache.ecrire('c', 3)
    expect(cache.lire('a')).toBeUndefined()
    expect(cache.lire('b')).toBeUndefined()
    expect(cache.lire('c')).toBe(3)
    cache.ecrire('d', 4)
    expect(cache.lire('c')).toBe(3)
    expect(cache.lire('d')).toBe(4)
  })
})
