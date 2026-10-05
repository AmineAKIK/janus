import { describe, expect, it, vi } from 'vitest'
import { creerHorlogeDemo, instantReel } from './horlogeDemo.ts'

const REELLE = Date.parse('2026-10-05T10:00:00.000Z')

describe('horloge de démo', () => {
  it('rend l’heure réelle quand rien n’a avancé', () => {
    const horloge = creerHorlogeDemo({ reelle: () => REELLE })

    expect(horloge.maintenantMs()).toBe(REELLE)
    expect(horloge.maintenant()).toBe('2026-10-05T10:00:00.000Z')
    expect(horloge.reel()).toBe('2026-10-05T10:00:00.000Z')
  })

  it('ajoute le décalage à l’heure réelle, qui continue de couler', () => {
    let reelle = REELLE
    const horloge = creerHorlogeDemo({ reelle: () => reelle })

    horloge.avancer(3 * 24 * 3_600_000)
    reelle += 60_000

    expect(horloge.maintenant()).toBe('2026-10-08T10:01:00.000Z')
    expect(horloge.reel()).toBe('2026-10-05T10:01:00.000Z')
    expect(horloge.decalageMs()).toBe(3 * 24 * 3_600_000)
  })

  it('cumule les avances', () => {
    const horloge = creerHorlogeDemo({ reelle: () => REELLE })

    horloge.avancer(3_600_000)
    horloge.avancer(3_600_000)

    expect(horloge.maintenant()).toBe('2026-10-05T12:00:00.000Z')
  })

  it('refuse de reculer ou d’avancer d’une durée qui n’est pas un entier', () => {
    const horloge = creerHorlogeDemo({ reelle: () => REELLE })

    expect(() => {
      horloge.avancer(-1)
    }).toThrow(RangeError)
    expect(() => {
      horloge.avancer(1.5)
    }).toThrow(RangeError)
    expect(() => {
      horloge.avancer(Number.NaN)
    }).toThrow(RangeError)
    expect(horloge.decalageMs()).toBe(0)
  })

  it('garde le décalage là où on le lui dit', () => {
    let range = 5000
    const horloge = creerHorlogeDemo({
      reelle: () => REELLE,
      decalage: {
        lire: () => range,
        ecrire: (ms) => {
          range = ms
        },
      },
    })

    horloge.avancer(1000)

    expect(range).toBe(6000)
    expect(horloge.maintenantMs()).toBe(REELLE + 6000)
  })

  it('instantReel lit l’horloge du système', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-05T10:00:00.000Z'))

    expect(instantReel()).toBe('2026-10-05T10:00:00.000Z')
    vi.useRealTimers()
  })
})
