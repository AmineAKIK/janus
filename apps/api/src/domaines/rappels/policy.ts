import type { Reglages, SortieRoute, ROUTES } from '@janus/contrats'
import { instantEnMs, jourDe } from '@janus/moteur'

type Aujourdhui = SortieRoute<(typeof ROUTES)['GET /aujourdhui']>

export interface CeQuiEstDu {
  readonly cartes: number
  readonly verifications: number
}

/** L'heure locale (`HH:MM`) d'un instant dans un fuseau. */
function heureLocale(instantIso: string, fuseau: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: fuseau,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instantEnMs(instantIso))
}

/**
 * Le rappel du jour est-il à envoyer maintenant ? Oui quand l'heure choisie est passée dans le
 * fuseau de l'utilisateur et qu'aucune pause n'est en cours. `jour` est le jour qui compte
 * (bascule comprise) : la clé d'unicité d'un rappel.
 */
export function rappelAEnvoyer(
  reglages: Reglages,
  maintenant: string,
): { readonly aEnvoyer: boolean; readonly jour: string } {
  const jour = jourDe(maintenant, reglages.fuseau, reglages.heureBascule)
  const enPause = reglages.rappelsEnPauseJusquAu !== null && jour <= reglages.rappelsEnPauseJusquAu
  const heurePassee = heureLocale(maintenant, reglages.fuseau) >= reglages.heureRappel
  return { aEnvoyer: heurePassee && !enPause, jour }
}

/** Ce qui est dû aujourd'hui : les cartes à revoir et les vérifications pas encore faites. */
export function ceQuiEstDu({ taches }: Aujourdhui): CeQuiEstDu {
  let cartes = 0
  let verifications = 0
  for (const { tache, faite } of taches) {
    if (tache.type === 'cartes') cartes += tache.dues
    else if (
      !faite &&
      (tache.type === 'verification' || tache.type === 'retest' || tache.type === 'entretien')
    ) {
      verifications += 1
    }
  }
  return { cartes, verifications }
}

/** « 12 cartes et 1 vérification t'attendent » ; `null` quand rien n'est dû. */
export function texteDuRappel({ cartes, verifications }: CeQuiEstDu): string | null {
  const parties = [
    cartes > 0 ? `${String(cartes)} ${cartes > 1 ? 'cartes' : 'carte'}` : null,
    verifications > 0
      ? `${String(verifications)} ${verifications > 1 ? 'vérifications' : 'vérification'}`
      : null,
  ].filter((partie) => partie !== null)
  if (parties.length === 0) return null
  return `${parties.join(' et ')} ${cartes + verifications > 1 ? 't’attendent' : 't’attend'}`
}
