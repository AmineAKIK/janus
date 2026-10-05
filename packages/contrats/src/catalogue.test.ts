import { describe, expect, it } from 'vitest'
import demo from '../fixtures/catalogue-demo.json' with { type: 'json' }
import { Catalogue, LIBELLE_MODULE_NON_IMPORTE } from './catalogue.ts'

describe('Catalogue', () => {
  it('accepte le catalogue de démonstration', () => {
    expect(Catalogue.safeParse(demo).success).toBe(true)
  })

  it('un module importé a ses parties et ses blocs dans l’ordre du plan', () => {
    const catalogue = Catalogue.parse(demo)
    const premier = catalogue.modules[0]
    expect(premier?.importe).toBe(true)
    if (premier?.importe === true) {
      expect(premier.parties.map((p) => p.code)).toEqual(['P1', 'P2'])
      expect(premier.parties[0]?.blocs).toEqual(['D01', 'D02'])
    }
  })

  it('un module non importé n’a pas de parties', () => {
    const catalogue = Catalogue.parse(demo)
    const second = catalogue.modules[1]
    expect(second?.importe).toBe(false)
    expect(second).not.toHaveProperty('parties')
  })

  it('refuse un module importé sans parties', () => {
    const copie = structuredClone(demo)
    Reflect.deleteProperty(copie.modules[0] ?? {}, 'parties')
    expect(Catalogue.safeParse(copie).success).toBe(false)
  })

  it('refuse des parties sur un module non importé', () => {
    const copie = structuredClone(demo)
    Object.assign(copie.modules[1] ?? {}, { parties: [] })
    expect(Catalogue.safeParse(copie).success).toBe(false)
  })

  it('refuse un code de partie mal formé', () => {
    const copie = structuredClone(demo)
    const module = copie.modules[0]
    if (module !== undefined && 'parties' in module) {
      Object.assign(module.parties[0] ?? {}, { code: 'partie 1' })
    }
    expect(Catalogue.safeParse(copie).success).toBe(false)
  })

  it('nomme l’état d’un module non importé', () => {
    expect(LIBELLE_MODULE_NON_IMPORTE).toBe('Pas encore importé')
  })
})
