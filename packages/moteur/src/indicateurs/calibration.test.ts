import { Reglages } from '@janus/contrats'
import type { Confiance, Niveau } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import type { Fait } from '../faits.ts'
import { calibration } from './calibration.ts'

const REGLAGES = Reglages.parse({})
const MAINTENANT = '2026-10-15T10:00:00Z'

let numero = 0
const correction = (
  date: string,
  confiance: Confiance,
  niveau: Niveau,
  options: { tour?: number; bloc?: string } = {},
): Fait => ({
  id: `f${String((numero += 1))}`,
  bloc: options.bloc ?? 'B01',
  date,
  type: 'correction',
  serie: 'restitution',
  question: `Q${String(numero)}`,
  tour: options.tour ?? 1,
  niveau,
  compte: true,
  confiance,
  erreursIa: [],
})

describe('calibration', () => {
  const faits: Fait[] = [
    correction('2026-10-13T10:00:00Z', 'sur', 'solide'),
    correction('2026-10-13T11:00:00Z', 'sur', 'solide'),
    correction('2026-10-14T10:00:00Z', 'sur', 'fragile', { bloc: 'B04' }),
    correction('2026-10-14T11:00:00Z', 'hesitant', 'partiel'),
    correction('2026-10-14T12:00:00Z', 'hasard', 'pas_encore'),
    // Un second tour ne compte pas.
    correction('2026-10-14T13:00:00Z', 'sur', 'solide', { tour: 2 }),
    // Il y a 20 jours, sûr et faux : dans la période 30 jours, pas dans 7 jours.
    correction('2026-09-25T10:00:00Z', 'sur', 'partiel'),
    // Autre type de fait.
    {
      id: 'x',
      bloc: 'B01',
      date: '2026-10-14T10:00:00Z',
      type: 'force_levee',
    },
  ]

  it('croise la confiance déclarée et le résultat au premier tour', () => {
    expect(calibration(faits, '30j', MAINTENANT, REGLAGES).lignes).toEqual([
      { confiance: 'sur', justes: 2, faux: 2 },
      { confiance: 'hesitant', justes: 0, faux: 1 },
      { confiance: 'hasard', justes: 0, faux: 1 },
    ])
  })

  it('suit la période pour le tableau mais pas pour les erreurs de la semaine', () => {
    const court = calibration(faits, '7j', MAINTENANT, REGLAGES)
    expect(court.lignes[0]).toEqual({ confiance: 'sur', justes: 2, faux: 1 })
    expect(court.erreursSuresCetteSemaine).toEqual([
      { bloc: 'B04', question: 'Q3', date: '2026-10-14T10:00:00Z' },
    ])
    expect(calibration(faits, 'tout', MAINTENANT, REGLAGES).erreursSuresCetteSemaine).toHaveLength(
      1,
    )
  })

  it('rend des lignes à zéro sans fait', () => {
    expect(calibration([], 'tout', MAINTENANT, REGLAGES)).toEqual({
      lignes: [
        { confiance: 'sur', justes: 0, faux: 0 },
        { confiance: 'hesitant', justes: 0, faux: 0 },
        { confiance: 'hasard', justes: 0, faux: 0 },
      ],
      erreursSuresCetteSemaine: [],
    })
  })
})
