import { describe, expect, it } from 'vitest'
import { blocsReportes, estVerification, lienDeLaTache } from './aujourdhui.ts'

describe('blocsReportes', () => {
  it('ne garde que les blocs reportés au-delà du jour', () => {
    const reports = [
      { bloc: 'B1', jusqua: '2026-10-09' },
      { bloc: 'B2', jusqua: '2026-10-08' },
    ]

    expect([...blocsReportes(reports, '2026-10-08')]).toEqual(['B1'])
  })
})

describe('lienDeLaTache', () => {
  const sansManifeste = () => undefined
  const verification = (bloc: string, type: string) => `${type}-${bloc}`

  it('mène chaque tâche à son écran', () => {
    expect(lienDeLaTache({ type: 'questions_debut', nombre: 3 }, sansManifeste, verification)).toBe(
      '/questions',
    )
    expect(
      lienDeLaTache({ type: 'cartes', dues: 1, nouvelles: 2 }, sansManifeste, verification),
    ).toBe('/revision')
    expect(lienDeLaTache({ type: 'bloc', bloc: 'B1' }, sansManifeste, verification)).toBe(
      '/blocs/B1',
    )
    expect(
      lienDeLaTache(
        { type: 'retest', bloc: 'B1', apres: '2026-10-01' },
        sansManifeste,
        verification,
      ),
    ).toBe('/verifications/retest-B1')
  })

  it('reconnaît les tâches de vérification', () => {
    expect(estVerification({ type: 'entretien', bloc: 'B1', apres: '2026-10-01' })).toBe(true)
    expect(estVerification({ type: 'bloc', bloc: 'B1' })).toBe(false)
  })
})
