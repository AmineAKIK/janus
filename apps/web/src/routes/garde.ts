import { ErreurApi, ErreurReseau, nomRoute, ROUTES } from '@janus/contrats'
import type { Transport } from '@janus/contrats'
import type { QueryClient } from '@tanstack/react-query'
import { redirect } from '@tanstack/react-router'

/** Ce que les routes reçoivent de l'appli : le cache des requêtes et le transport. */
export interface ContexteRouteur {
  readonly client: QueryClient
  readonly transport: Transport
}

/** La clé du compte dans le cache : la même que celle de `useLecture(ROUTES['GET /moi'], {})`. */
export const CLE_MOI = [nomRoute(ROUTES['GET /moi']), {}] as const

/**
 * La garde : tout écran sauf la connexion exige une session. Tant que le compte est dans le cache la
 * session est connue ; sinon on le demande (`GET /moi`). Un `401` mène à la connexion en gardant la page
 * demandée. Hors connexion on laisse passer : les écrans disent eux-mêmes que le réseau manque.
 */
export async function exigerSession(
  contexte: ContexteRouteur,
  pageDemandee: string,
): Promise<void> {
  const { client, transport } = contexte
  if (client.getQueryData(CLE_MOI) !== undefined) return
  try {
    client.setQueryData(CLE_MOI, await transport.appeler(ROUTES['GET /moi'], {}))
  } catch (erreur) {
    if (erreur instanceof ErreurApi && erreur.status === 401) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- c'est ainsi que TanStack Router redirige
      throw redirect({ to: '/connexion', search: { retour: pageDemandee } })
    }
    if (erreur instanceof ErreurReseau) return
    throw erreur
  }
}
