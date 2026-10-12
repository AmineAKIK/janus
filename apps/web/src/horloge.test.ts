import { describe, expect, it, vi } from 'vitest'
import { instantReel } from './horloge.ts'

describe('horloge', () => {
  it('instantReel lit l’horloge du système', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-05T10:00:00.000Z'))

    expect(instantReel()).toBe('2026-10-05T10:00:00.000Z')
    vi.useRealTimers()
  })
})
