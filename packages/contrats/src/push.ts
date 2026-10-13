import { z } from 'zod'
import { Texte } from './primitives.ts'

/** Le message d'une notification push : ce que l'API envoie et ce que le service worker affiche. */
export const NotificationPush = z.strictObject({
  titre: Texte,
  corps: Texte,
})
export type NotificationPush = z.infer<typeof NotificationPush>
