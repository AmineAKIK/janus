/** Ce que l'API garde d'un abonnement push. */
export interface AbonnementPush {
  readonly endpoint: string
  readonly cles: { readonly p256dh: string; readonly auth: string }
}

/** La clé publique VAPID (base64 URL) en octets, comme `pushManager.subscribe` la demande. */
export function cleEnOctets(cle: string): Uint8Array<ArrayBuffer> {
  const base64 = cle.replace(/-/g, '+').replace(/_/g, '/')
  const binaire = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
  return Uint8Array.from(binaire, (caractere) => caractere.charCodeAt(0))
}

/**
 * Demande l'autorisation puis abonne cet appareil au service de push du navigateur.
 * Rend `null` si l'autorisation est refusée ou si le navigateur ne sait pas faire.
 */
export async function abonnerCetAppareil(cleVapid: string): Promise<AbonnementPush | null> {
  if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) return null
  if ((await Notification.requestPermission()) !== 'granted') return null
  const enregistrement = await navigator.serviceWorker.ready
  const abonnement = await enregistrement.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: cleEnOctets(cleVapid),
  })
  const { endpoint, keys } = abonnement.toJSON()
  const p256dh = keys?.['p256dh']
  const auth = keys?.['auth']
  if (endpoint === undefined || p256dh === undefined || auth === undefined) return null
  return { endpoint, cles: { p256dh, auth } }
}

const CLE_ABONNEMENT = 'janus.abonnement-push'

/** L'identifiant sous lequel le serveur connaît l'abonnement de cet appareil, s'il y en a un. */
export function abonnementGarde(): string | null {
  try {
    return localStorage.getItem(CLE_ABONNEMENT)
  } catch {
    return null
  }
}

export function garderAbonnement(id: string | null): void {
  try {
    if (id === null) localStorage.removeItem(CLE_ABONNEMENT)
    else localStorage.setItem(CLE_ABONNEMENT, id)
  } catch {
    // Sans stockage local, l'appareil ne pourra pas se désabonner depuis les Paramètres.
  }
}

/** Retire l'abonnement de cet appareil auprès du navigateur : il ne reçoit plus rien. */
export async function retirerCetAppareil(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  const enregistrement = await navigator.serviceWorker.ready
  await (await enregistrement.pushManager.getSubscription())?.unsubscribe()
}
