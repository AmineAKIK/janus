import { Reglages } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import { dernieresSemaines, lundiDe, semaineDe } from './semaines.ts'

const REGLAGES = Reglages.parse({})

describe('lundiDe', () => {
  it('rend le lundi de la semaine du lundi au dimanche', () => {
    expect(lundiDe('2026-10-12')).toBe('2026-10-12')
    expect(lundiDe('2026-10-15')).toBe('2026-10-12')
    expect(lundiDe('2026-10-18')).toBe('2026-10-12')
    expect(lundiDe('2026-10-19')).toBe('2026-10-19')
  })

  it('passe un changement de mois et d’année', () => {
    expect(lundiDe('2027-01-01')).toBe('2026-12-28')
    expect(lundiDe('1969-12-31')).toBe('1969-12-29')
  })
})

describe('semaineDe', () => {
  it('compte la nuit d’avant l’heure de bascule pour la veille', () => {
    // Paris est à UTC+2 en octobre : 01:30 UTC = 03:30 locale, avant 4 h.
    expect(semaineDe('2026-10-12T01:30:00Z', REGLAGES)).toBe('2026-10-05')
    expect(semaineDe('2026-10-12T02:00:00Z', REGLAGES)).toBe('2026-10-12')
  })
})

describe('dernieresSemaines', () => {
  it('rend les lundis, du plus ancien à la semaine courante', () => {
    expect(dernieresSemaines('2026-10-15T10:00:00Z', REGLAGES, 4)).toEqual([
      '2026-09-21',
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
    ])
  })
})
