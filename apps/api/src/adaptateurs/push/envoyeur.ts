/** Où envoyer : l'abonnement que le navigateur a donné. */
export interface Destinataire {
  readonly endpoint: string
  readonly cles: { readonly p256dh: string; readonly auth: string }
}

/** Ce que la notification affiche. */
export interface Notification {
  readonly titre: string
  readonly corps: string
}

/**
 * L'envoi d'une notification Web Push. `expire` : le service de push ne connaît plus cet
 * abonnement (404 ou 410), on le supprime. Toute autre erreur est levée.
 */
export interface Envoyeur {
  readonly envoyer: (
    destinataire: Destinataire,
    notification: Notification,
  ) => Promise<'envoye' | 'expire'>
}
