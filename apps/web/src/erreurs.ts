import { construireEnvoi, lireDsn } from '@janus/contrats'

/** Ce dont le suivi a besoin de la fenêtre : être prévenu de chaque erreur qu'aucun code n'a rattrapée. */
export interface CibleErreurs {
  surErreur(ecouteur: (cause: unknown) => void): void
}

/** Les erreurs non rattrapées d'une fenêtre : `error` et promesses rejetées. */
export function cibleFenetre(fenetre: Window): CibleErreurs {
  return {
    surErreur: (ecouteur) => {
      fenetre.addEventListener('error', (evenement) => {
        ecouteur(evenement.error)
      })
      fenetre.addEventListener('unhandledrejection', (evenement) => {
        ecouteur(evenement.reason)
      })
    },
  }
}

export interface OptionsSuiviErreurs {
  /** `VITE_SENTRY_DSN` : absent ou invalide, rien n'est écouté ni envoyé. */
  readonly dsn: string | undefined
  readonly cible: CibleErreurs
  /** L'instant, en ISO 8601 (jamais l'heure système lue ici). */
  readonly maintenant: () => string
  /** Poste l'enveloppe, sans attendre ni échouer (`navigator.sendBeacon`). */
  readonly envoyer: (url: string, corps: string) => void
  readonly identifiant: () => string
}

/** Un même chargement de page n'envoie jamais plus d'erreurs que cela. */
export const MAX_ERREURS_PAR_PAGE = 10

/**
 * Le suivi d'erreurs facultatif du front : s'il y a un DSN, les erreurs non rattrapées partent vers
 * Sentry ou GlitchTip avec leur type et leur pile, jamais leur message, une réponse ou un texte saisi.
 */
export function suivreLesErreurs({
  dsn,
  cible,
  maintenant,
  envoyer,
  identifiant,
}: OptionsSuiviErreurs): boolean {
  const lu = lireDsn(dsn)
  if (lu === null) return false
  let envoyees = 0
  const signaler = (cause: unknown) => {
    if (envoyees >= MAX_ERREURS_PAR_PAGE) return
    envoyees += 1
    const erreur = cause instanceof Error ? cause : null
    const envoi = construireEnvoi(
      lu,
      { nom: erreur?.name ?? 'Error', pile: erreur?.stack ?? '' },
      { plateforme: 'javascript', instant: maintenant(), identifiant: identifiant() },
    )
    envoyer(envoi.url, envoi.corps)
  }
  cible.surErreur(signaler)
  return true
}
