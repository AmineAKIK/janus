import { InstantaneDonnees, nomRoute, ROUTES } from '@janus/contrats'
import type { QueryClient } from '@tanstack/react-query'

/**
 * Les lectures qui s'affichent sans réseau : celles des écrans de consultation. Tout le reste (le
 * compte, les sessions, une série de révision ou une vérification en cours, les exports) exige le
 * réseau et n'est jamais gardé sur l'appareil. Une route absente de cette liste n'est pas gardée.
 */
const ROUTES_GARDEES = [
  ROUTES['GET /aujourdhui'],
  ROUTES['GET /formations'],
  ROUTES['GET /formations/:id/modules'],
  ROUTES['GET /modules/:id/blocs'],
  ROUTES['GET /blocs/:id'],
  ROUTES['GET /tableau-de-bord'],
  ROUTES['GET /journal'],
  ROUTES['GET /reglages'],
]

const SCHEMAS = new Map(ROUTES_GARDEES.map((route) => [nomRoute(route), route.reponse]))

/** Les lectures réussies des écrans de consultation, prêtes à être gardées. */
export function capturer(client: QueryClient): InstantaneDonnees {
  const requetes: InstantaneDonnees['requetes'] = client
    .getQueryCache()
    .findAll()
    .flatMap((requete) => {
      const [nom, entree] = requete.queryKey
      if (typeof nom !== 'string' || !SCHEMAS.has(nom)) return []
      if (requete.state.status !== 'success' || requete.state.data === undefined) return []
      const cle: [string, unknown] = [nom, entree]
      return [{ cle, donnees: requete.state.data, mis_a_jour: requete.state.dataUpdatedAt }]
    })
  return { version: 1, requetes }
}

/**
 * Remet dans le cache ce qui a été gardé, en jetant tout ce qui ne passe plus le schéma de sa route
 * (une version de l'appli plus récente a pu le changer). Rend le nombre de lectures reprises.
 */
export function restaurer(client: QueryClient, brut: unknown): number {
  const lecture = InstantaneDonnees.safeParse(brut)
  if (!lecture.success) return 0
  let reprises = 0
  for (const { cle, donnees, mis_a_jour: misAJour } of lecture.data.requetes) {
    const schema = SCHEMAS.get(cle[0])
    if (schema === undefined) continue
    const valide = schema.safeParse(donnees)
    if (!valide.success) continue
    client.setQueryData(cle, valide.data, { updatedAt: misAJour })
    reprises += 1
  }
  return reprises
}

/** L'instant de la lecture la plus récente dans le cache, ou `null` quand rien n'a encore été lu. */
export function derniereMiseAJour(client: QueryClient): number | null {
  const instants = client
    .getQueryCache()
    .findAll()
    .flatMap(({ queryKey, state }) =>
      typeof queryKey[0] === 'string' && SCHEMAS.has(queryKey[0]) && state.dataUpdatedAt > 0
        ? [state.dataUpdatedAt]
        : [],
    )
  return instants.length === 0 ? null : Math.max(...instants)
}
