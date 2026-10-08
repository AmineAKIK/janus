import { afterEach, describe, expect, it, vi } from 'vitest'
import { abonnerCetAppareil, cleEnOctets } from './push.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

function navigateurAvec(options: { permission: NotificationPermission; cles?: boolean }) {
  const subscribe = vi.fn(() =>
    Promise.resolve({
      toJSON: () => ({
        endpoint: 'https://push.test/abonnement',
        ...(options.cles === false ? {} : { keys: { p256dh: 'clef', auth: 'secret' } }),
      }),
    }),
  )
  vi.stubGlobal('Notification', {
    requestPermission: vi.fn(() => Promise.resolve(options.permission)),
  })
  vi.stubGlobal('navigator', {
    serviceWorker: { ready: Promise.resolve({ pushManager: { subscribe } }) },
  })
  return subscribe
}

describe('cleEnOctets', () => {
  it('décode une clé base64 URL', () => {
    expect(Array.from(cleEnOctets('AQID-_8'))).toEqual([1, 2, 3, 251, 255])
  })
})

describe('abonnerCetAppareil', () => {
  it('abonne l’appareil avec la clé du serveur et rend ce que l’API garde', async () => {
    const subscribe = navigateurAvec({ permission: 'granted' })

    const abonnement = await abonnerCetAppareil('AQID')

    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: new Uint8Array([1, 2, 3]),
    })
    expect(abonnement).toEqual({
      endpoint: 'https://push.test/abonnement',
      cles: { p256dh: 'clef', auth: 'secret' },
    })
  })

  it('ne s’abonne pas quand l’autorisation est refusée', async () => {
    const subscribe = navigateurAvec({ permission: 'denied' })

    expect(await abonnerCetAppareil('AQID')).toBeNull()
    expect(subscribe).not.toHaveBeenCalled()
  })

  it('rend null si le navigateur ne donne pas les clés', async () => {
    navigateurAvec({ permission: 'granted', cles: false })

    expect(await abonnerCetAppareil('AQID')).toBeNull()
  })

  it('rend null quand le navigateur ne sait pas envoyer de notifications', async () => {
    vi.stubGlobal('navigator', {})

    expect(await abonnerCetAppareil('AQID')).toBeNull()
  })
})
