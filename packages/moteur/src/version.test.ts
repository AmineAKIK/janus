import { describe, expect, it } from 'vitest'
import { VERSION_MOTEUR } from './version.ts'

describe('VERSION_MOTEUR', () => {
  it('est un entier positif : l’API la compare à celle des lignes qu’elle a rangées', () => {
    expect(Number.isInteger(VERSION_MOTEUR)).toBe(true)
    expect(VERSION_MOTEUR).toBeGreaterThan(0)
  })
})
