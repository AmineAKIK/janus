// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CLE_TAILLE,
  CLE_THEME,
  appliquerTaille,
  appliquerTheme,
  lireTaille,
  lireTheme,
} from './theme.ts'

function fausseRacine(): { dataset: Record<string, string> } {
  return { dataset: {} }
}

function fauxStockage(contenu: Record<string, string> = {}): Storage {
  const donnees = new Map(Object.entries(contenu))
  return {
    get length() {
      return donnees.size
    },
    clear: () => {
      donnees.clear()
    },
    getItem: (cle) => donnees.get(cle) ?? null,
    key: (index) => [...donnees.keys()][index] ?? null,
    removeItem: (cle) => {
      donnees.delete(cle)
    },
    setItem: (cle, valeur) => {
      donnees.set(cle, valeur)
    },
  }
}

function stockageIndisponible(): Storage {
  const echec = (): never => {
    throw new DOMException('Stockage bloqué', 'SecurityError')
  }
  return {
    get length(): number {
      return echec()
    },
    clear: echec,
    getItem: echec,
    key: echec,
    removeItem: echec,
    setItem: echec,
  }
}

let racine: { dataset: Record<string, string> }

beforeEach(() => {
  racine = fausseRacine()
  vi.stubGlobal('document', { documentElement: racine })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('lireTheme et lireTaille', () => {
  it('rendent systeme et standard par défaut', () => {
    vi.stubGlobal('localStorage', fauxStockage())
    expect(lireTheme()).toBe('systeme')
    expect(lireTaille()).toBe('standard')
  })

  it('rendent la valeur enregistrée', () => {
    vi.stubGlobal('localStorage', fauxStockage({ [CLE_THEME]: 'sombre', [CLE_TAILLE]: 'grand' }))
    expect(lireTheme()).toBe('sombre')
    expect(lireTaille()).toBe('grand')
  })

  it('ignorent une valeur inconnue', () => {
    vi.stubGlobal('localStorage', fauxStockage({ [CLE_THEME]: 'violet', [CLE_TAILLE]: '200' }))
    expect(lireTheme()).toBe('systeme')
    expect(lireTaille()).toBe('standard')
  })

  it('rendent les valeurs par défaut quand le stockage est indisponible', () => {
    vi.stubGlobal('localStorage', stockageIndisponible())
    expect(lireTheme()).toBe('systeme')
    expect(lireTaille()).toBe('standard')
  })
})

describe('appliquerTheme et appliquerTaille', () => {
  it("écrivent l'attribut sur <html> et dans le stockage", () => {
    const stockage = fauxStockage()
    vi.stubGlobal('localStorage', stockage)

    appliquerTheme('clair')
    appliquerTaille('petit')

    expect(racine.dataset['theme']).toBe('clair')
    expect(racine.dataset['taille']).toBe('petit')
    expect(stockage.getItem(CLE_THEME)).toBe('clair')
    expect(stockage.getItem(CLE_TAILLE)).toBe('petit')
  })

  it("fonctionnent sans stockage : l'attribut est posé, rien ne plante", () => {
    vi.stubGlobal('localStorage', stockageIndisponible())

    expect(() => {
      appliquerTheme('sombre')
      appliquerTaille('grand')
    }).not.toThrow()
    expect(racine.dataset['theme']).toBe('sombre')
    expect(racine.dataset['taille']).toBe('grand')
  })
})
