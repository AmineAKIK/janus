import { describe, expect, it } from 'vitest'
import { dureeRetiree, tempsDeLaFormation } from './axeTemps.ts'

const JOUR_MS = 86_400_000

describe('temps d’une formation', () => {
  it('ne retire que les jours entiers d’une pause', () => {
    const pause = { debut: '2026-10-01T10:00:00.000Z', fin: '2026-10-04T20:00:00.000Z' }
    expect(dureeRetiree(pause)).toBe(3 * JOUR_MS)
    expect(dureeRetiree({ debut: pause.debut, fin: '2026-10-01T23:59:59.999Z' })).toBe(0)
  })

  it('rend l’heure réelle sans pause', () => {
    expect(tempsDeLaFormation('2026-10-12T10:00:00.000Z', [])).toBe('2026-10-12T10:00:00.000Z')
  })

  it('compte la reprise comme si le temps ne s’était pas écoulé, jours entiers', () => {
    const pauses = [{ debut: '2026-10-01T10:00:00.000Z', fin: '2026-10-04T20:00:00.000Z' }]
    // 10 heures après la reprise : les 3 jours gelés ne comptent pas.
    expect(tempsDeLaFormation('2026-10-05T06:00:00.000Z', pauses)).toBe('2026-10-02T06:00:00.000Z')
  })

  it('additionne plusieurs pauses', () => {
    const pauses = [
      { debut: '2026-10-01T00:00:00.000Z', fin: '2026-10-03T00:00:00.000Z' },
      { debut: '2026-10-10T00:00:00.000Z', fin: '2026-10-11T12:00:00.000Z' },
    ]
    expect(tempsDeLaFormation('2026-10-20T00:00:00.000Z', pauses)).toBe('2026-10-17T00:00:00.000Z')
  })

  it('s’arrête au début de la pause en cours', () => {
    const pauses = [
      { debut: '2026-10-01T00:00:00.000Z', fin: '2026-10-03T00:00:00.000Z' },
      { debut: '2026-10-10T08:00:00.000Z', fin: null },
    ]
    const a = tempsDeLaFormation('2026-10-11T00:00:00.000Z', pauses)
    const b = tempsDeLaFormation('2026-11-30T00:00:00.000Z', pauses)
    expect(a).toBe('2026-10-08T08:00:00.000Z')
    expect(b).toBe(a)
  })
})
