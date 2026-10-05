import { describe, expect, it, vi } from 'vitest'
import { IdUuidV7, nouvelId } from './ids.ts'

const T0 = 1_700_000_000_000

describe('IdUuidV7', () => {
  it('accepte un UUID version 7', () => {
    expect(IdUuidV7.safeParse('018f3c2e-7b1a-7c4d-9e2f-0123456789ab').success).toBe(true)
  })

  it('refuse un UUID d’une autre version', () => {
    expect(IdUuidV7.safeParse('f47ac10b-58cc-4372-a567-0e02b2c3d479').success).toBe(false)
  })

  it('refuse une mauvaise variante', () => {
    expect(IdUuidV7.safeParse('018f3c2e-7b1a-7c4d-1e2f-0123456789ab').success).toBe(false)
  })

  it('refuse du texte quelconque avec un message en français', () => {
    const resultat = IdUuidV7.safeParse('pas-un-uuid')
    expect(resultat.error?.issues[0]?.message).toBe('L’identifiant doit être un UUID version 7.')
    expect(IdUuidV7.safeParse(12).error?.issues[0]?.message).toBe(
      'L’identifiant doit être un texte.',
    )
  })
})

describe('nouvelId', () => {
  it('produit un UUID v7 valide : version 7, variante 10xx', () => {
    const id = nouvelId(T0)
    expect(IdUuidV7.safeParse(id).success).toBe(true)
    expect(id.charAt(14)).toBe('7')
    expect('89ab').toContain(id.charAt(19))
  })

  it('encode l’instant fourni sur 48 bits', () => {
    const id = nouvelId(T0 + 10_000)
    const temps = parseInt(id.slice(0, 8) + id.slice(9, 13), 16)
    expect(temps).toBe(T0 + 10_000)
  })

  it('rend 1 000 identifiants strictement croissants, même dans la même milliseconde', () => {
    const base = T0 + 100_000
    const ids = Array.from({ length: 1000 }, () => nouvelId(base))
    expect(new Set(ids).size).toBe(1000)
    expect([...ids].sort()).toEqual(ids)
  })

  it('reste croissant quand l’instant avance entre deux appels', () => {
    const ids = Array.from({ length: 1000 }, (_, i) => nouvelId(T0 + 200_000 + Math.floor(i / 7)))
    expect([...ids].sort()).toEqual(ids)
  })

  it('ne décroît pas si l’horloge recule', () => {
    const premier = nouvelId(T0 + 300_000)
    const second = nouvelId(T0 + 299_000)
    expect(second > premier).toBe(true)
  })

  it('avance d’une milliseconde au-delà de 4 096 identifiants dans la même milliseconde', () => {
    const base = T0 + 400_000
    const ids = Array.from({ length: 5000 }, () => nouvelId(base))
    expect(new Set(ids).size).toBe(5000)
    expect([...ids].sort()).toEqual(ids)
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, 2 ** 48])(
    'refuse l’instant %s sans fausser les identifiants suivants',
    (instant) => {
      const avant = nouvelId(T0 + 600_000)
      expect(() => nouvelId(instant)).toThrow(RangeError)
      const apres = nouvelId(T0 + 600_000)
      expect(apres > avant).toBe(true)
      expect(parseInt(apres.slice(0, 8) + apres.slice(9, 13), 16)).toBe(T0 + 600_000)
    },
  )

  it('accepte l’instant maximal de 48 bits, puis refuse de dépasser', async () => {
    // Module neuf : cet instant ne doit pas rester dans l'état partagé des autres tests.
    vi.resetModules()
    const { nouvelId: neuf } = await import('./ids.ts')
    const maximum = 2 ** 48 - 1
    expect(neuf(maximum).slice(0, 13)).toBe('ffffffff-ffff')
    expect(() => Array.from({ length: 5000 }, () => neuf(maximum))).toThrow(RangeError)
  })

  it('ne répète pas la partie aléatoire d’un appel à l’autre', () => {
    const base = T0 + 500_000
    const fins = new Set(Array.from({ length: 50 }, () => nouvelId(base).slice(19)))
    expect(fins.size).toBeGreaterThan(40)
  })
})
