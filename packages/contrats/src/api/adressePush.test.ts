import { describe, expect, it } from 'vitest'
import { estAdressePush } from './reglages.ts'

describe('estAdressePush', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/abc',
  ])('accepte %s', (adresse) => {
    expect(estAdressePush(adresse)).toBe(true)
  })

  it.each([
    'http://fcm.googleapis.com/abc',
    'https://127.0.0.1/abc',
    'https://10.0.0.5:3000/abc',
    'https://[::1]/abc',
    'https://localhost/abc',
    'https://api/abc',
    'https://postgres:5432/',
    'https://service.internal/abc',
    'https://utilisateur:secret@fcm.googleapis.com/abc',
    'file:///etc/passwd',
    'pas-une-url',
  ])('refuse %s', (adresse) => {
    expect(estAdressePush(adresse)).toBe(false)
  })
})
