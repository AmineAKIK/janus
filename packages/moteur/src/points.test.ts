import { describe, expect, it } from 'vitest'
import { points } from './points.ts'

describe('points', () => {
  it.each([
    ['solide', 1],
    ['partiel', 0.5],
    ['fragile', 0.25],
    ['pas_encore', 0],
  ] as const)('%s vaut %s', (niveau, attendu) => {
    expect(points(niveau)).toBe(attendu)
  })
})
