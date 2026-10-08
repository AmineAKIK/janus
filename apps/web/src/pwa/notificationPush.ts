import { NotificationPush } from '@janus/contrats'

/** Lit le message d'un événement `push` ; `null` s'il manque, n'est pas du JSON ou n'a pas la forme attendue. */
export function lireNotification(
  donnees: { json(): unknown } | null | undefined,
): NotificationPush | null {
  if (donnees === null || donnees === undefined) return null
  try {
    const lue = NotificationPush.safeParse(donnees.json())
    return lue.success ? lue.data : null
  } catch {
    return null
  }
}
