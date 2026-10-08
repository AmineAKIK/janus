import { Reglages } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import { tempsActif } from './temps.ts'
import type { MesureTemps } from './temps.ts'

const REGLAGES = Reglages.parse({})
// Un jeudi : la semaine courante va du lundi 12 au dimanche 18 octobre 2026.
const MAINTENANT = '2026-10-15T10:00:00Z'

describe('tempsActif', () => {
  it('rend zéro partout sans mesure', () => {
    expect(tempsActif([], MAINTENANT, REGLAGES)).toEqual({
      totalS: 0,
      groupes: { lecture: 0, pratique: 0, restitution: 0 },
      blocs: [],
    })
  })

  it('range chaque type d’étape dans son groupe et garde le total, bloc par bloc', () => {
    const mesures: MesureTemps[] = [
      { date: '2026-10-12T10:00:00Z', bloc: 'B01', secondes: 60, etape: 'carte' },
      { date: '2026-10-12T10:01:00Z', bloc: 'B01', secondes: 30, etape: 'pretest' },
      { date: '2026-10-12T10:02:00Z', bloc: 'B01', secondes: 10, etape: 'explication' },
      { date: '2026-10-13T10:00:00Z', bloc: 'B02', secondes: 120, etape: 'pratique' },
      { date: '2026-10-13T10:02:00Z', bloc: 'B02', secondes: 20, etape: 'atelier' },
      { date: '2026-10-13T10:03:00Z', bloc: 'B02', secondes: 5, etape: 'aisance' },
      { date: '2026-10-14T10:00:00Z', bloc: 'B03', secondes: 7, etape: 'restitution' },
      { date: '2026-10-14T10:01:00Z', bloc: 'B03', secondes: 8, etape: 'consolidation' },
      { date: '2026-10-14T10:02:00Z', bloc: 'B03', secondes: 9, etape: 'bilan' },
    ]
    expect(tempsActif(mesures, MAINTENANT, REGLAGES)).toEqual({
      totalS: 269,
      groupes: { lecture: 100, pratique: 145, restitution: 24 },
      blocs: [
        { bloc: 'B02', secondes: 145 },
        { bloc: 'B01', secondes: 100 },
        { bloc: 'B03', secondes: 24 },
      ],
    })
  })

  it('compte le temps sans étape dans le total et le bloc, pas dans un groupe', () => {
    const mesures: MesureTemps[] = [{ date: '2026-10-12T10:00:00Z', bloc: 'B01', secondes: 42 }]
    const temps = tempsActif(mesures, MAINTENANT, REGLAGES)
    expect(temps.totalS).toBe(42)
    expect(temps.groupes).toEqual({ lecture: 0, pratique: 0, restitution: 0 })
    expect(temps.blocs).toEqual([{ bloc: 'B01', secondes: 42 }])
  })

  it('range à égalité les blocs par code', () => {
    const mesures: MesureTemps[] = [
      { date: '2026-10-12T10:00:00Z', bloc: 'B02', secondes: 10 },
      { date: '2026-10-12T10:00:00Z', bloc: 'B01', secondes: 10 },
    ]
    expect(tempsActif(mesures, MAINTENANT, REGLAGES).blocs.map(({ bloc }) => bloc)).toEqual([
      'B01',
      'B02',
    ])
  })

  it('change de semaine le lundi et respecte la bascule à 4 h', () => {
    const mesures: MesureTemps[] = [
      // Dimanche 11 à 23 h 30 locale : semaine dernière.
      { date: '2026-10-11T21:30:00Z', bloc: 'B01', secondes: 100 },
      // Lundi 12 à 3 h 30 locale : encore la journée de dimanche, donc semaine dernière.
      { date: '2026-10-12T01:30:00Z', bloc: 'B01', secondes: 200 },
      // Lundi 12 à 4 h 30 locale : cette semaine.
      { date: '2026-10-12T02:30:00Z', bloc: 'B01', secondes: 5 },
    ]
    expect(tempsActif(mesures, MAINTENANT, REGLAGES).totalS).toBe(5)
  })
})
