import { describe, expect, it } from 'vitest'
import {
  ESSAIS_PAR_MINUTE,
  INACTIVITE_MAX_MS,
  activiteAReecrire,
  creerLimiteur,
  octets,
  sessionActive,
} from './policy.ts'

const DEBUT = '2026-10-01T10:00:00.000Z'
const apres = (ms: number) => new Date(Date.parse(DEBUT) + ms).toISOString()
const HEURE = 3_600_000

const session = (surcharge: Partial<Parameters<typeof sessionActive>[0]> = {}) => ({
  expireLe: apres(30 * 24 * HEURE),
  persistante: false,
  derniereActivite: DEBUT,
  ...surcharge,
})

describe('sessionActive', () => {
  it('vit tant que l’activité est récente', () => {
    expect(sessionActive(session(), apres(INACTIVITE_MAX_MS - 1))).toBe(true)
  })

  it('meurt après 12 h sans activité, sauf « Rester connecté »', () => {
    expect(sessionActive(session(), apres(INACTIVITE_MAX_MS))).toBe(false)
    expect(sessionActive(session({ persistante: true }), apres(INACTIVITE_MAX_MS * 2))).toBe(true)
  })

  it('meurt à son expiration, même persistante', () => {
    const persistante = session({ persistante: true, derniereActivite: apres(29 * 24 * HEURE) })

    expect(sessionActive(persistante, apres(30 * 24 * HEURE - 1))).toBe(true)
    expect(sessionActive(persistante, apres(30 * 24 * HEURE))).toBe(false)
  })
})

describe('activiteAReecrire', () => {
  it('attend une minute entre deux écritures', () => {
    expect(activiteAReecrire(session(), apres(59_999))).toBe(false)
    expect(activiteAReecrire(session(), apres(60_000))).toBe(true)
  })
})

describe('octets', () => {
  it('compte en UTF-8, pas en caractères', () => {
    expect(octets('abc')).toBe(3)
    expect(octets('é')).toBe(2)
    expect(octets('😀')).toBe(4)
  })
})

describe('le limiteur d’essais', () => {
  it('laisse passer 5 essais par minute, refuse le 6e et dit quand réessayer', () => {
    const limiteur = creerLimiteur()
    for (let essai = 0; essai < ESSAIS_PAR_MINUTE; essai += 1) {
      expect(limiteur.tenter('ip|amine', apres(essai * 1000)).autorise).toBe(true)
    }

    const refus = limiteur.tenter('ip|amine', apres(10_000))

    expect(refus).toEqual({ autorise: false, reessayerDansS: 50 })
  })

  it('compte à part chaque clé', () => {
    const limiteur = creerLimiteur()
    for (let essai = 0; essai < ESSAIS_PAR_MINUTE; essai += 1) limiteur.tenter('ip|amine', DEBUT)

    expect(limiteur.tenter('ip|autre', DEBUT).autorise).toBe(true)
    expect(limiteur.tenter('autre-ip|amine', DEBUT).autorise).toBe(true)
  })

  it('libère la clé quand la minute est passée', () => {
    const limiteur = creerLimiteur()
    for (let essai = 0; essai < ESSAIS_PAR_MINUTE; essai += 1) limiteur.tenter('ip|amine', DEBUT)

    expect(limiteur.tenter('ip|amine', apres(59_999)).autorise).toBe(false)
    expect(limiteur.tenter('ip|amine', apres(60_000)).autorise).toBe(true)
  })
})
