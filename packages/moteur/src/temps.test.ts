import { describe, expect, it } from 'vitest'
import { ajouterJours, ajouterMois, debutDuJour, ecartEnJours, jourDe } from './temps.ts'

const PARIS = 'Europe/Paris'

describe('jourDe', () => {
  it('compte une séance finie à 1 h 30 pour la veille', () => {
    // 1 h 30 à Paris (UTC+2 en été) = 23 h 30 UTC la veille.
    expect(jourDe('2026-07-14T23:30:00Z', PARIS, 4)).toBe('2026-07-14')
  })

  it('compte une séance à 4 h 01 pour le jour même', () => {
    expect(jourDe('2026-07-15T02:01:00Z', PARIS, 4)).toBe('2026-07-15')
  })

  it('bascule exactement à l’heure de bascule', () => {
    expect(jourDe('2026-07-15T01:59:00Z', PARIS, 4)).toBe('2026-07-14')
    expect(jourDe('2026-07-15T02:00:00Z', PARIS, 4)).toBe('2026-07-15')
  })

  it('traite minuit comme l’heure 0 et non 24', () => {
    expect(jourDe('2026-07-14T22:00:00Z', PARIS, 4)).toBe('2026-07-14')
  })

  it('garde le jour calendaire quand la bascule vaut 0', () => {
    expect(jourDe('2026-07-14T22:30:00Z', PARIS, 0)).toBe('2026-07-15')
  })

  it('recule d’un mois quand le jour local est le 1er', () => {
    expect(jourDe('2026-08-01T00:30:00Z', PARIS, 4)).toBe('2026-07-31')
  })

  it('donne le bon jour à 4 h 30 le dernier dimanche de mars (passage à l’heure d’été)', () => {
    // 4 h 30 à Paris le 29 mars 2026 (UTC+2) = 2 h 30 UTC.
    expect(jourDe('2026-03-29T02:30:00Z', PARIS, 4)).toBe('2026-03-29')
    // 3 h 30 est déjà en heure d’été : toujours avant la bascule.
    expect(jourDe('2026-03-29T01:30:00Z', PARIS, 4)).toBe('2026-03-28')
    // Juste avant le saut de 2 h à 3 h.
    expect(jourDe('2026-03-29T00:59:00Z', PARIS, 4)).toBe('2026-03-28')
  })

  it('donne le bon jour à 3 h 30 le dernier dimanche d’octobre (passage à l’heure d’hiver)', () => {
    // 3 h 30 à Paris le 25 octobre 2026 (UTC+1) = 2 h 30 UTC : avant la bascule.
    expect(jourDe('2026-10-25T02:30:00Z', PARIS, 4)).toBe('2026-10-24')
    // 2 h 30 existe deux fois cette nuit-là, les deux comptent pour la veille.
    expect(jourDe('2026-10-25T00:30:00Z', PARIS, 4)).toBe('2026-10-24')
    expect(jourDe('2026-10-25T01:30:00Z', PARIS, 4)).toBe('2026-10-24')
    // 4 h 30 en heure d’hiver = 3 h 30 UTC.
    expect(jourDe('2026-10-25T03:30:00Z', PARIS, 4)).toBe('2026-10-25')
  })

  it('utilise le fuseau demandé', () => {
    expect(jourDe('2026-07-15T02:01:00Z', 'America/New_York', 4)).toBe('2026-07-14')
  })

  it.each([
    ['pas une date'],
    ['2026-02-30T12:00:00Z'],
    ['2026-07-14T12:00:00'],
    ['2026-07-14T12:00:00+02:00'],
    ['2026-07-14T24:00:00Z'],
    ['2026-07-14'],
    ['July 14, 2026 12:00:00 UTC'],
  ])('refuse l’instant %s', (instant) => {
    expect(() => jourDe(instant, PARIS, 4)).toThrow(`Instant illisible : ${instant}`)
  })

  it('accepte les millisecondes', () => {
    expect(jourDe('2026-07-15T02:01:00.123Z', PARIS, 4)).toBe('2026-07-15')
  })
})

describe('ajouterJours', () => {
  it('ajoute et retire des jours, mois et années compris', () => {
    expect(ajouterJours('2026-07-14', 3)).toBe('2026-07-17')
    expect(ajouterJours('2026-07-30', 3)).toBe('2026-08-02')
    expect(ajouterJours('2026-12-30', 3)).toBe('2027-01-02')
    expect(ajouterJours('2026-03-01', -1)).toBe('2026-02-28')
    expect(ajouterJours('2028-03-01', -1)).toBe('2028-02-29')
  })

  it('ne dépend pas des changements d’heure', () => {
    expect(ajouterJours('2026-03-28', 2)).toBe('2026-03-30')
    expect(ajouterJours('2026-10-24', 2)).toBe('2026-10-26')
  })

  it('refuse un jour mal formé ou impossible', () => {
    expect(() => ajouterJours('2026-7-1', 1)).toThrow('Jour illisible : 2026-7-1')
    expect(() => ajouterJours('2026-02-30', 1)).toThrow('Jour illisible : 2026-02-30')
  })
})

describe('ajouterMois', () => {
  it('ajoute des mois en gardant le quantième', () => {
    expect(ajouterMois('2026-01-15', 3)).toBe('2026-04-15')
    expect(ajouterMois('2026-11-15', 3)).toBe('2027-02-15')
    expect(ajouterMois('2026-03-15', -3)).toBe('2025-12-15')
    expect(ajouterMois('2026-07-14', 12)).toBe('2027-07-14')
  })

  it('ramène au dernier jour du mois quand le quantième n’existe pas', () => {
    expect(ajouterMois('2026-01-31', 1)).toBe('2026-02-28')
    expect(ajouterMois('2028-01-31', 1)).toBe('2028-02-29')
    expect(ajouterMois('2026-08-31', 1)).toBe('2026-09-30')
  })
})

describe('ecartEnJours', () => {
  it('compte les jours entre deux jours, signe compris', () => {
    expect(ecartEnJours('2026-07-14', '2026-07-17')).toBe(3)
    expect(ecartEnJours('2026-07-17', '2026-07-14')).toBe(-3)
    expect(ecartEnJours('2026-07-14', '2026-07-14')).toBe(0)
  })

  it('compte juste à travers les changements d’heure', () => {
    expect(ecartEnJours('2026-03-28', '2026-03-30')).toBe(2)
    expect(ecartEnJours('2026-10-24', '2026-10-26')).toBe(2)
    expect(ecartEnJours('2026-01-01', '2027-01-01')).toBe(365)
  })
})

describe('debutDuJour', () => {
  it('rend minuit du fuseau plus l’heure de bascule', () => {
    expect(debutDuJour('2026-07-15', PARIS, 4)).toBe('2026-07-15T02:00:00.000Z')
    expect(debutDuJour('2026-07-15', PARIS, 0)).toBe('2026-07-14T22:00:00.000Z')
  })

  it('suit le changement d’heure', () => {
    expect(debutDuJour('2026-03-29', PARIS, 4)).toBe('2026-03-29T02:00:00.000Z')
    expect(debutDuJour('2026-10-25', PARIS, 4)).toBe('2026-10-25T03:00:00.000Z')
  })

  it('est l’inverse de jourDe : l’instant d’avant est la veille', () => {
    for (const jour of ['2026-07-15', '2026-03-29', '2026-10-25']) {
      const debut = debutDuJour(jour, PARIS, 4)
      const veille = new Date(Date.parse(debut) - 1).toISOString()

      expect(jourDe(debut, PARIS, 4)).toBe(jour)
      expect(jourDe(veille, PARIS, 4)).toBe(ajouterJours(jour, -1))
    }
  })

  it('marche pour un fuseau à l’ouest', () => {
    expect(debutDuJour('2026-07-15', 'America/New_York', 4)).toBe('2026-07-15T08:00:00.000Z')
  })
})
