import type { Destinataire, Envoyeur, Notification } from './envoyeur.ts'

interface EnvoiNote {
  readonly destinataire: Destinataire
  readonly notification: Notification
}

/** Un envoyeur de test : garde ce qu'on lui demande d'envoyer, fait expirer les adresses qu'on lui désigne et échoue sur celles « en panne ». */
export function creerEnvoyeurFaux(
  expirees: ReadonlySet<string> = new Set(),
  enPanne: ReadonlySet<string> = new Set(),
) {
  const envois: EnvoiNote[] = []
  const envoyeur: Envoyeur = {
    envoyer: (destinataire, notification) => {
      if (enPanne.has(destinataire.endpoint)) {
        return Promise.reject(new Error('Le service de push ne répond pas'))
      }
      if (expirees.has(destinataire.endpoint)) return Promise.resolve('expire')
      envois.push({ destinataire, notification })
      return Promise.resolve('envoye')
    },
  }
  return { envoyeur, envois }
}
