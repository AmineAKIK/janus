import { construireEnvoi, lireDsn } from '@janus/contrats'
import type { Horloge } from '../horloge.ts'
import type { SignalerErreur } from '../types.ts'

export interface OptionsSuiviErreurs {
  /** `SENTRY_DSN` : absent ou invalide, rien n'est envoyé. */
  readonly dsn: string | undefined
  readonly horloge: Horloge
  /** Poste l'enveloppe ; ses échecs ne remontent jamais jusqu'à la requête. */
  readonly envoyer: (url: string, corps: string) => Promise<void>
  /** 32 caractères hexadécimaux uniques. */
  readonly identifiant: () => string
  /** Où va la trace d'un envoi qui échoue. */
  readonly echec: (cause: unknown) => void
}

/**
 * Signale une erreur inattendue à Sentry ou GlitchTip : son type, sa pile, la méthode et la route
 * (le modèle d'adresse, jamais l'adresse réelle, ni l'en-tête, ni le corps, ni le message).
 */
export function creerSuiviErreurs(options: OptionsSuiviErreurs): SignalerErreur | undefined {
  const dsn = lireDsn(options.dsn)
  if (dsn === null) return undefined
  return (erreur, requete) => {
    const envoi = construireEnvoi(
      dsn,
      {
        nom: erreur.name,
        pile: erreur.stack ?? '',
        etiquettes: { methode: requete.method, route: requete.routeOptions.url ?? 'inconnue' },
      },
      {
        plateforme: 'node',
        instant: options.horloge.maintenant(),
        identifiant: options.identifiant(),
      },
    )
    options.envoyer(envoi.url, envoi.corps).catch(options.echec)
  }
}
