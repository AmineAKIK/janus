import type {
  DefinitionRoute,
  EntreeRoute,
  OptionsAppel,
  SortieRoute,
  Transport,
} from '@janus/contrats'
import { ErreurApi, ErreurDonnees, nomRoute, ROUTES } from '@janus/contrats'
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from '@tanstack/react-query'
import { createContext, use } from 'react'
import type { ReactNode } from 'react'

const FRAICHEUR_MS = 30_000

export interface ReactionsErreurs {
  /** Un `401` : la session n'existe plus. Le cache est déjà vidé. */
  readonly surNonAuthentifie: () => void
}

const estErreurClient = (erreur: unknown) =>
  erreur instanceof ErreurApi && erreur.status >= 400 && erreur.status < 500

/**
 * Le client TanStack Query de l'appli :
 * - lectures : données fraîches 30 s, un nouvel essai sauf pour une erreur que rien ne changera
 *   (réponse hors schéma, refus du serveur) ; écritures : jamais de nouvel essai ;
 * - `401` : le cache est vidé puis `surNonAuthentifie` mène à la connexion ;
 * - `409` : l'état du serveur a changé, les données sont rechargées ;
 * - une réponse hors schéma est journalisée en console et remonte à la frontière d'erreur.
 */
export function creerClientRequetes({ surNonAuthentifie }: ReactionsErreurs): QueryClient {
  // Vider le cache relance les lectures encore affichées, qui répondent `401` à leur tour : une seule
  // fois par session perdue, jusqu'à ce qu'une requête réussisse de nouveau.
  let sessionPerdue = false
  const reprise = () => {
    sessionPerdue = false
  }
  const traiter = (erreur: unknown) => {
    if (erreur instanceof ErreurDonnees) {
      console.error(`[janus] ${erreur.message}`, erreur.erreurs)
    } else if (erreur instanceof ErreurApi && erreur.status === 401) {
      if (sessionPerdue) return
      sessionPerdue = true
      client.clear()
      surNonAuthentifie()
    } else if (erreur instanceof ErreurApi && erreur.status === 409) {
      void client.invalidateQueries()
    }
  }
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: traiter, onSuccess: reprise }),
    mutationCache: new MutationCache({
      // Un mauvais mot de passe répond 401 sans que la session soit perdue : l'écran de connexion s'en occupe.
      onError: (erreur, _variables, _contexte, mutation) => {
        if (mutation.options.mutationKey?.[0] !== nomRoute(ROUTES['POST /session'])) traiter(erreur)
      },
      onSuccess: reprise,
    }),
    defaultOptions: {
      queries: {
        staleTime: FRAICHEUR_MS,
        retry: (nombreEchecs, erreur) =>
          nombreEchecs < 1 && !(erreur instanceof ErreurDonnees) && !estErreurClient(erreur),
        throwOnError: (erreur) => erreur instanceof ErreurDonnees,
      },
      mutations: { retry: false },
    },
  })
  return client
}

const ContexteTransport = createContext<Transport | null>(null)

export function FournisseurApi({
  transport,
  client,
  children,
}: {
  readonly transport: Transport
  readonly client: QueryClient
  readonly children: ReactNode
}) {
  return (
    <ContexteTransport value={transport}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </ContexteTransport>
  )
}

function useTransport(): Transport {
  const transport = use(ContexteTransport)
  if (transport === null) throw new Error('FournisseurApi manquant')
  return transport
}

type RouteLecture = DefinitionRoute & { readonly methode: 'GET' }

/** Lit une route `GET` : la réponse est déjà validée par le transport. */
export function useLecture<D extends RouteLecture>(route: D, entree: EntreeRoute<D>) {
  const transport = useTransport()
  return useQuery({
    queryKey: [nomRoute(route), entree],
    queryFn: ({ signal }) => transport.appeler(route, entree, { signal } satisfies OptionsAppel),
  })
}

/** Écrit sur une route : un appel par `mutate`, jamais rejoué tout seul. */
export function useEcriture<D extends DefinitionRoute>(route: D) {
  const transport = useTransport()
  return useMutation<SortieRoute<D>, Error, EntreeRoute<D>>({
    mutationKey: [nomRoute(route)],
    mutationFn: (entree) => transport.appeler(route, entree),
  })
}
