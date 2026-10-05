import { describe, expect, it, vi } from 'vitest'
import { CLE_STOCKAGE, creerMagasin, etatVide } from './store.ts'
import type { Stockage } from './store.ts'

const T0 = '2026-10-05T10:00:00.000Z'

function stockageEnMemoire(initial: Record<string, string> = {}) {
  const valeurs = new Map(Object.entries(initial))
  const stockage: Stockage = {
    getItem: (cle) => valeurs.get(cle) ?? null,
    setItem: (cle, valeur) => {
      valeurs.set(cle, valeur)
    },
  }
  return { stockage, valeurs }
}

describe('étatVide', () => {
  it('est un état valide, déconnecté, sans fait', () => {
    const etat = etatVide(T0)

    expect(etat).toMatchObject({
      version: 1,
      premierLancement: T0,
      decalageMs: 0,
      sessionOuverte: false,
      faits: [],
    })
    expect(etat.reglages.delaiConsolidationMinutes).toBe(60)
  })
})

describe('magasin', () => {
  it('crée l’état au premier lancement et le recopie dans le stockage', () => {
    const { stockage, valeurs } = stockageEnMemoire()

    const magasin = creerMagasin({ stockage, creerEtat: () => etatVide(T0) })

    expect(magasin.lire().premierLancement).toBe(T0)
    expect(JSON.parse(valeurs.get(CLE_STOCKAGE) ?? 'null')).toMatchObject({ premierLancement: T0 })
  })

  it('garde toutes les actions faites après un rechargement', () => {
    const { stockage } = stockageEnMemoire()
    const premier = creerMagasin({ stockage, creerEtat: () => etatVide(T0) })
    premier.ecrire((etat) => ({ ...etat, sessionOuverte: true, idsRecus: ['a'] }))

    const apresRechargement = creerMagasin({
      stockage,
      creerEtat: () => etatVide('2030-01-01T00:00:00.000Z'),
    })

    expect(apresRechargement.lire()).toMatchObject({
      premierLancement: T0,
      sessionOuverte: true,
      idsRecus: ['a'],
    })
  })

  it('repart d’un état neuf si le stockage est illisible ou ne respecte pas le format', () => {
    for (const brut of [
      'pas du json',
      '{"version":2}',
      JSON.stringify({ ...etatVide(T0), extra: 1 }),
    ]) {
      const { stockage } = stockageEnMemoire({ [CLE_STOCKAGE]: brut })

      const magasin = creerMagasin({
        stockage,
        creerEtat: () => etatVide('2027-01-01T00:00:00.000Z'),
      })

      expect(magasin.lire().premierLancement).toBe('2027-01-01T00:00:00.000Z')
    }
  })

  it('marche sans persistance quand le stockage est indisponible', () => {
    const magasin = creerMagasin({ stockage: null, creerEtat: () => etatVide(T0) })

    magasin.ecrire((etat) => ({ ...etat, sessionOuverte: true }))

    expect(magasin.lire().sessionOuverte).toBe(true)
  })

  it('marche quand le stockage refuse d’écrire (plein) ou de lire', () => {
    const casse: Stockage = {
      getItem: () => {
        throw new Error('refusé')
      },
      setItem: () => {
        throw new Error('quota')
      },
    }

    const magasin = creerMagasin({ stockage: casse, creerEtat: () => etatVide(T0) })
    magasin.ecrire((etat) => ({ ...etat, sessionOuverte: true }))

    expect(magasin.lire().sessionOuverte).toBe(true)
  })

  it('refuse un état invalide sans toucher à l’état en cours', () => {
    const { stockage } = stockageEnMemoire()
    const magasin = creerMagasin({ stockage, creerEtat: () => etatVide(T0) })

    expect(() => {
      magasin.ecrire((etat) => ({ ...etat, decalageMs: 1.5 }))
    }).toThrow()
    expect(magasin.lire().decalageMs).toBe(0)
  })

  it('réinitialise avec un autre état', () => {
    const { stockage, valeurs } = stockageEnMemoire()
    const magasin = creerMagasin({ stockage, creerEtat: () => etatVide(T0) })
    const ecrire = vi.spyOn(stockage, 'setItem')

    magasin.reinitialiser(etatVide('2026-11-01T00:00:00.000Z'))

    expect(magasin.lire().premierLancement).toBe('2026-11-01T00:00:00.000Z')
    expect(ecrire).toHaveBeenCalledOnce()
    expect(valeurs.get(CLE_STOCKAGE)).toContain('2026-11-01')
  })
})
