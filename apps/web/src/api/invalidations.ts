import { nomRoute, ROUTES } from '@janus/contrats'
import type { QueryClient } from '@tanstack/react-query'

/** Les lectures que l'apprentissage (une réponse, une carte, une vérification, un statut) peut changer. */
const LECTURES_DE_L_APPRENTISSAGE: ReadonlySet<string> = new Set(
  [
    'GET /aujourdhui',
    'GET /tableau-de-bord',
    'GET /blocs/:id',
    'GET /modules/:id/blocs',
    'GET /cartes/dues',
    'GET /questions-debut',
    'GET /verifications/:id',
    'GET /journal',
  ].map((cle) => nomRoute(ROUTES[cle as keyof typeof ROUTES])),
)

/**
 * Après un message accepté par le serveur ou un changement de statut : les écrans qui montrent
 * l'avancement se relisent. Les réglages, les sessions et le profil ne bougent pas pour autant.
 */
export function invaliderApprentissage(client: QueryClient): Promise<void> {
  return client.invalidateQueries({
    predicate: ({ queryKey }) =>
      typeof queryKey[0] === 'string' && LECTURES_DE_L_APPRENTISSAGE.has(queryKey[0]),
  })
}
