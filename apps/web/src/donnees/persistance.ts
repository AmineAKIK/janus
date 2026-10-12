import type { QueryClient } from '@tanstack/react-query'
import { capturer, restaurer } from './instantane.ts'
import type { StockageDonnees } from './stockageDonnees.ts'

/** L'attente avant d'écrire : les lectures d'un écran arrivent en rafale, une seule écriture suffit. */
export const DELAI_ECRITURE_MS = 1000
/** Au démarrage on n'attend pas le stockage plus longtemps : mieux vaut s'ouvrir sans données gardées. */
const DELAI_LECTURE_MS = 800

/** Remet dans le cache les dernières données gardées ; sans réponse du stockage à temps, rien n'est repris. */
export async function reprendreLesDonnees(
  client: QueryClient,
  stockage: StockageDonnees,
  delaiMs = DELAI_LECTURE_MS,
): Promise<number> {
  const attente = new Promise<null>((resolve) => {
    setTimeout(() => {
      resolve(null)
    }, delaiMs)
  })
  try {
    const brut = await Promise.race([stockage.lire(), attente])
    return brut === null ? 0 : restaurer(client, brut)
  } catch {
    return 0
  }
}

/**
 * Garde les lectures du cache sur l'appareil à mesure qu'elles arrivent. Dès que le cache n'a plus
 * rien à garder (déconnexion, session perdue) le stockage est vidé tout de suite : les données d'un
 * compte ne restent jamais après sa sortie. Rend la fonction qui arrête de suivre.
 */
export function garderLesDonnees(
  client: QueryClient,
  stockage: StockageDonnees,
  delaiMs = DELAI_ECRITURE_MS,
): () => void {
  let minuteur: ReturnType<typeof setTimeout> | undefined
  const ecrire = () => {
    minuteur = undefined
    const instantane = capturer(client)
    const operation =
      instantane.requetes.length === 0 ? stockage.effacer() : stockage.ecrire(instantane)
    operation.catch(() => {
      // Stockage plein ou refusé : l'appli marche, simplement sans données gardées.
    })
  }
  return client.getQueryCache().subscribe((evenement) => {
    if (evenement.type === 'removed') {
      if (capturer(client).requetes.length === 0) {
        clearTimeout(minuteur)
        ecrire()
        return
      }
    } else if (evenement.type !== 'updated' || evenement.action.type !== 'success') {
      return
    }
    clearTimeout(minuteur)
    minuteur = setTimeout(ecrire, delaiMs)
  })
}
