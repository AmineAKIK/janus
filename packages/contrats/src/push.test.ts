import { describe, expect, it } from 'vitest'
import { NotificationPush } from './push.ts'

describe('NotificationPush', () => {
  it('accepte un titre et un corps', () => {
    expect(NotificationPush.parse({ titre: 'Atelier', corps: '1 carte t’attend' })).toEqual({
      titre: 'Atelier',
      corps: '1 carte t’attend',
    })
  })

  it.each([{}, { titre: 'Atelier' }, { titre: '', corps: 'x' }, { titre: 'a', corps: 'b', x: 1 }])(
    'refuse %j',
    (valeur) => {
      expect(NotificationPush.safeParse(valeur).success).toBe(false)
    },
  )
})
