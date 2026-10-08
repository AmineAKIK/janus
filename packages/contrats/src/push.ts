import { z } from 'zod'

/** Le message d'une notification push : ce que l'API envoie et ce que le service worker affiche. */
export const NotificationPush = z.strictObject({
  titre: z.string().trim().min(1),
  corps: z.string().trim().min(1),
})
export type NotificationPush = z.infer<typeof NotificationPush>
