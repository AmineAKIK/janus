import { Reglages } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import type { Fait } from '../faits.ts'
import { autonomie } from './autonomie.ts'

const REGLAGES = Reglages.parse({})
const MAINTENANT = '2026-10-15T10:00:00Z'

let numero = 0
const item = (date: string, reussi: boolean, aide: 0 | 1 | 2 | 3 | 4): Fait => ({
  id: `f${String((numero += 1))}`,
  bloc: 'B01',
  date,
  type: 'pratique_resultat',
  exercice: 'E1',
  item: `I${String(numero)}`,
  reussi,
  aide,
})

describe('autonomie', () => {
  it('compte, par semaine, les items de pratique réussis à l’aide 0', () => {
    const faits: Fait[] = [
      // Il y a 3 semaines : 1 sur 2.
      item('2026-09-22T10:00:00Z', true, 0),
      item('2026-09-23T10:00:00Z', true, 2),
      // Semaine dernière : 0 sur 1 (aide 0 mais raté).
      item('2026-10-07T10:00:00Z', false, 0),
      // Cette semaine : 2 sur 3, aides 0, 0 et 3.
      item('2026-10-12T10:00:00Z', true, 0),
      item('2026-10-13T10:00:00Z', true, 0),
      item('2026-10-14T10:00:00Z', false, 3),
      // Trop ancien : hors des 4 semaines.
      item('2026-09-01T10:00:00Z', true, 0),
      // Un fait d'un autre type est ignoré.
      {
        id: 'x',
        bloc: 'B01',
        date: '2026-10-13T10:00:00Z',
        type: 'atelier_resultat',
        reussi: true,
        aide: 0,
      },
    ]
    const resultat = autonomie(faits, MAINTENANT, REGLAGES)

    expect(resultat.semaines).toEqual([
      { debut: '2026-09-21', sansAide: 1, total: 2, part: 0.5 },
      { debut: '2026-09-28', sansAide: 0, total: 0, part: null },
      { debut: '2026-10-05', sansAide: 0, total: 1, part: 0 },
      { debut: '2026-10-12', sansAide: 2, total: 3, part: 2 / 3 },
    ])
    expect(resultat.aideMoyenne).toBe(1)
  })

  it('ne rend ni part ni aide moyenne sans item', () => {
    const resultat = autonomie([], MAINTENANT, REGLAGES)
    expect(resultat.semaines.map(({ part }) => part)).toEqual([null, null, null, null])
    expect(resultat.aideMoyenne).toBeNull()
  })

  it('change de semaine à l’heure de bascule', () => {
    const faits = [
      // 03:30 à Paris, lundi : encore dimanche, donc la semaine d'avant.
      item('2026-10-12T01:30:00Z', true, 0),
      item('2026-10-12T02:30:00Z', true, 0),
    ]
    const resultat = autonomie(faits, MAINTENANT, REGLAGES)
    expect(resultat.semaines.map(({ total }) => total)).toEqual([0, 0, 1, 1])
  })
})
