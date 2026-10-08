import { instantEnMs } from '@janus/moteur'

const MINUTE_MS = 60_000
const HEURE_MS = 3_600_000

/** « Rester connecté » : 30 jours. Sans cela, le cookie meurt avec le navigateur. */
export const DUREE_PERSISTANTE_JOURS = 30
/** Une session sans « Rester connecté » expire après 12 h sans activité. */
export const INACTIVITE_MAX_MS = 12 * HEURE_MS
/** La dernière activité se met à jour au plus une fois par minute. */
export const PAS_ACTIVITE_MS = MINUTE_MS
/** Les essais de connexion : 5 par minute. */
export const ESSAIS_PAR_MINUTE = 5
export const FENETRE_ESSAIS_MS = MINUTE_MS

export interface EtatSession {
  readonly expireLe: string
  readonly persistante: boolean
  readonly derniereActivite: string
}

export function sessionActive(session: EtatSession, maintenant: string): boolean {
  const ms = instantEnMs(maintenant)
  if (ms >= instantEnMs(session.expireLe)) return false
  return session.persistante || ms - instantEnMs(session.derniereActivite) < INACTIVITE_MAX_MS
}

/** Faut-il écrire la dernière activité ? Au plus une fois par minute. */
export function activiteAReecrire(session: EtatSession, maintenant: string): boolean {
  return instantEnMs(maintenant) - instantEnMs(session.derniereActivite) >= PAS_ACTIVITE_MS
}

/** La longueur d'un mot de passe en octets UTF-8 : bcrypt ne lit que les 72 premiers. */
export function octets(texte: string): number {
  return new TextEncoder().encode(texte).length
}
export const OCTETS_MAX = 72

/**
 * Le limiteur d'essais de connexion : au plus 5 par minute et par clé (adresse + nom d'utilisateur).
 * Fenêtre glissante, en mémoire : l'API tourne sur un seul serveur.
 */
export function creerLimiteur() {
  const essais = new Map<string, number[]>()
  return {
    /** Compte un essai ; si la clé en a trop, rend dans combien de secondes réessayer. */
    tenter(
      cle: string,
      maintenant: string,
    ): { readonly autorise: true } | { readonly autorise: false; readonly reessayerDansS: number } {
      const ms = instantEnMs(maintenant)
      for (const [autre, instants] of essais) {
        const recents = instants.filter((instant) => ms - instant < FENETRE_ESSAIS_MS)
        if (recents.length === 0) essais.delete(autre)
        else essais.set(autre, recents)
      }
      const recents = essais.get(cle) ?? []
      const plusAncien = recents[0]
      if (recents.length >= ESSAIS_PAR_MINUTE && plusAncien !== undefined) {
        return {
          autorise: false,
          reessayerDansS: Math.max(1, Math.ceil((plusAncien + FENETRE_ESSAIS_MS - ms) / 1000)),
        }
      }
      essais.set(cle, [...recents, ms])
      return { autorise: true }
    },
  }
}
