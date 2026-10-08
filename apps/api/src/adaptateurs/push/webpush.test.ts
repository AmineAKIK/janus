import webpush from 'web-push'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { creerWebPush } from './webpush.ts'

vi.mock('web-push', () => {
  class WebPushError extends Error {
    readonly statusCode: number
    constructor(message: string, statusCode: number) {
      super(message)
      this.statusCode = statusCode
    }
  }
  return { default: { sendNotification: vi.fn(), WebPushError } }
})

const envoyeur = creerWebPush({ sujet: 'mailto:a@b.test', clePublique: 'pub', clePrivee: 'priv' })
const DESTINATAIRE = { endpoint: 'https://push.test/x', cles: { p256dh: 'p', auth: 'a' } }
const NOTIFICATION = { titre: 'Atelier', corps: '1 carte t’attend' }
const envoi = vi.mocked(webpush.sendNotification)

afterEach(() => {
  envoi.mockReset()
})

describe('creerWebPush', () => {
  it('envoie le message en JSON, signé avec les clés VAPID', async () => {
    envoi.mockResolvedValue({ statusCode: 201, body: '', headers: {} })

    expect(await envoyeur.envoyer(DESTINATAIRE, NOTIFICATION)).toBe('envoye')

    expect(envoi).toHaveBeenCalledWith(
      { endpoint: DESTINATAIRE.endpoint, keys: DESTINATAIRE.cles },
      JSON.stringify(NOTIFICATION),
      expect.objectContaining({
        vapidDetails: { subject: 'mailto:a@b.test', publicKey: 'pub', privateKey: 'priv' },
      }),
    )
  })

  it.each([404, 410])('un abonnement qui répond %i a expiré', async (statut) => {
    envoi.mockRejectedValue(
      new webpush.WebPushError('perdu', statut, {}, '', DESTINATAIRE.endpoint),
    )

    expect(await envoyeur.envoyer(DESTINATAIRE, NOTIFICATION)).toBe('expire')
  })

  it('laisse remonter les autres erreurs', async () => {
    envoi.mockRejectedValue(new webpush.WebPushError('panne', 500, {}, '', DESTINATAIRE.endpoint))

    await expect(envoyeur.envoyer(DESTINATAIRE, NOTIFICATION)).rejects.toThrow('panne')
  })
})
