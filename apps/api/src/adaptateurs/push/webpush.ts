import webpush from 'web-push'
import type { Envoyeur } from './envoyeur.ts'

export interface ConfigWebPush {
  readonly sujet: string
  readonly clePublique: string
  readonly clePrivee: string
}

/** Le service de push ne connaît plus l'abonnement. */
const ABONNEMENT_PERDU = new Set([404, 410])

/** L'envoi par `web-push` : chiffrement du message, signature VAPID, appel au service du navigateur. */
export function creerWebPush({ sujet, clePublique, clePrivee }: ConfigWebPush): Envoyeur {
  return {
    envoyer: async ({ endpoint, cles }, notification) => {
      try {
        await webpush.sendNotification({ endpoint, keys: cles }, JSON.stringify(notification), {
          vapidDetails: { subject: sujet, publicKey: clePublique, privateKey: clePrivee },
          TTL: 60 * 60 * 12,
        })
        return 'envoye'
      } catch (erreur) {
        if (erreur instanceof webpush.WebPushError && ABONNEMENT_PERDU.has(erreur.statusCode)) {
          return 'expire'
        }
        throw erreur
      }
    },
  }
}

/**
 * Refuse de démarrer avec des clés VAPID inutilisables : sinon l'API répond normalement et chaque
 * rappel échoue en silence. Lève avec la raison de `web-push`.
 */
export function verifierCleVapid({ sujet, clePublique, clePrivee }: ConfigWebPush): void {
  webpush.setVapidDetails(sujet, clePublique, clePrivee)
}
