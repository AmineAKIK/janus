import { describe, expect, it } from 'vitest'
import { formaterDate } from './format.ts'

describe('formaterDate', () => {
  const aujourdhui = '2026-10-05'

  it('dit « aujourd’hui » et « demain »', () => {
    expect(formaterDate('2026-10-05', aujourdhui)).toBe('aujourd’hui')
    expect(formaterDate('2026-10-06', aujourdhui)).toBe('demain')
  })

  it('écrit le jour et le mois abrégé, sans l’année en cours', () => {
    expect(formaterDate('2026-11-01', aujourdhui)).toBe('1 nov.')
    expect(formaterDate('2026-03-29', aujourdhui)).toBe('29 mars')
    expect(formaterDate('2026-12-24', aujourdhui)).toBe('24 déc.')
  })

  it('ajoute l’année quand ce n’est pas l’année en cours', () => {
    expect(formaterDate('2027-01-15', aujourdhui)).toBe('15 janv. 2027')
  })
})
