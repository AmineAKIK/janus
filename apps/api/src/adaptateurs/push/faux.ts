import type { Destinataire, Envoyeur, Notification } from './envoyeur.ts'

export interface EnvoiNote {
  readonly destinataire: Destinataire
  readonly notification: Notification
}

/** Un envoyeur de test : garde ce qu'on lui demande d'envoyer, et fait expirer les adresses qu'on lui désigne. */
export function creerEnvoyeurFaux(expirees: ReadonlySet<string> = new Set()) {
  const envois: EnvoiNote[] = []
  const envoyeur: Envoyeur = {
    envoyer: (destinataire, notification) => {
      if (expirees.has(destinataire.endpoint)) return Promise.resolve('expire')
      envois.push({ destinataire, notification })
      return Promise.resolve('envoye')
    },
  }
  return { envoyeur, envois }
}
