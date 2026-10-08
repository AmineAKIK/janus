import { describe, expect, it } from 'vitest'
import { etagDe, reglagesDonnes, reglesTouchees, versionDeIfMatch } from './policy.ts'

describe('versionDeIfMatch', () => {
  it.each([
    ['"3"', 3],
    ['W/"12"', 12],
    [' "1" ', 1],
  ])('lit %s', (entete, version) => {
    expect(versionDeIfMatch(entete)).toBe(version)
  })

  it.each([undefined, '', '*', '"abc"', '"0"', '"-1"', '"1.5"', '"9999999999"'])(
    'refuse %s',
    (entete) => {
      expect(versionDeIfMatch(entete)).toBeUndefined()
    },
  )

  it('relit ce que etagDe écrit', () => {
    expect(versionDeIfMatch(etagDe(42))).toBe(42)
  })
})

describe('règles de la méthode', () => {
  it('reconnaît les règles protégées, pas les autres réglages', () => {
    expect(reglesTouchees({ delaiRetestJours: 10, entretienMois: [3] })).toEqual([
      'delaiRetestJours',
      'entretienMois',
    ])
    expect(reglesTouchees({ questionsDebut: 3, fuseau: 'Europe/Paris' })).toEqual([])
  })

  it('ne garde que les réglages donnés', () => {
    expect(reglagesDonnes({ questionsDebut: 3, fuseau: undefined })).toEqual({ questionsDebut: 3 })
  })
})
