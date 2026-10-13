import { describe, expect, it, vi } from 'vitest'
import { creerAbonnes } from './abonnes.ts'

describe('creerAbonnes', () => {
  it('prévient tous les abonnés à chaque signal', () => {
    const { abonner, signaler } = creerAbonnes()
    const premier = vi.fn()
    const second = vi.fn()
    abonner(premier)
    abonner(second)

    signaler()
    signaler()

    expect(premier).toHaveBeenCalledTimes(2)
    expect(second).toHaveBeenCalledTimes(2)
  })

  it('ne prévient plus un abonné qui a arrêté d’écouter', () => {
    const { abonner, signaler } = creerAbonnes()
    const reste = vi.fn()
    const part = vi.fn()
    abonner(reste)
    const arreter = abonner(part)

    arreter()
    signaler()

    expect(reste).toHaveBeenCalledTimes(1)
    expect(part).not.toHaveBeenCalled()
  })

  it('se passe à useSyncExternalStore sans `this` : les fonctions sont détachables', () => {
    const { abonner, signaler } = creerAbonnes()
    const detache = abonner
    const abonne = vi.fn()
    detache(abonne)
    signaler()
    expect(abonne).toHaveBeenCalledTimes(1)
  })
})
