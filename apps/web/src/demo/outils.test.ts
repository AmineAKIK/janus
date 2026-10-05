import { afterEach, describe, expect, it, vi } from 'vitest'
import { creerHorlogeDemo } from './horlogeDemo.ts'
import { creerOutilsDemo } from './outils.ts'
import { creerMagasin, etatVide } from './store.ts'

const T0 = '2026-10-05T10:00:00.000Z'

function monter(graine?: (maintenant: string) => ReturnType<typeof etatVide>) {
  const magasin = creerMagasin({ stockage: null, creerEtat: () => etatVide(T0) })
  const horloge = creerHorlogeDemo({
    reelle: () => Date.parse('2026-10-05T12:00:00.000Z'),
    decalage: {
      lire: () => magasin.lire().decalageMs,
      ecrire: (ms) => {
        magasin.ecrire((etat) => ({ ...etat, decalageMs: ms }))
      },
    },
  })
  const apres = vi.fn()
  const outils = creerOutilsDemo({
    magasin,
    horloge,
    apres,
    ...(graine === undefined ? {} : { graine }),
  })
  return { magasin, horloge, outils, apres }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('window.__janusDemo', () => {
  it('avance l’horloge et prévient l’appli', () => {
    const { outils, horloge, apres } = monter()

    outils.avancer(3_600_000)

    expect(horloge.maintenant()).toBe('2026-10-05T13:00:00.000Z')
    expect(apres).toHaveBeenCalledOnce()
  })

  it('réinitialise à vide : horloge remise à l’heure réelle, aucun fait', () => {
    const { outils, magasin, horloge, apres } = monter()
    outils.avancer(86_400_000)
    magasin.ecrire((etat) => ({ ...etat, sessionOuverte: true }))

    outils.reinitialiser('vide')

    expect(magasin.lire()).toMatchObject({
      premierLancement: '2026-10-05T12:00:00.000Z',
      decalageMs: 0,
      sessionOuverte: false,
    })
    expect(horloge.maintenant()).toBe('2026-10-05T12:00:00.000Z')
    expect(apres).toHaveBeenCalledTimes(2)
  })

  it('réinitialise à la graine, datée par rapport à l’heure réelle', () => {
    const graine = vi.fn((maintenant: string) => ({
      ...etatVide(maintenant),
      sessionOuverte: true,
    }))
    const { outils, magasin } = monter(graine)

    outils.reinitialiser('graine')

    expect(graine).toHaveBeenCalledWith('2026-10-05T12:00:00.000Z')
    expect(magasin.lire().sessionOuverte).toBe(true)
  })
})
