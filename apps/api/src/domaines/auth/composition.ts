import type { FastifyPluginAsync } from 'fastify'
import type { Dependances, ResoudreSession } from '../../types.ts'
import { creerHacheur } from './adaptateur.ts'
import type { Hacheur } from './adaptateur.ts'
import { creerControleurAuth } from './controleur.ts'
import { creerDepotAuth } from './depot.ts'
import { routesAuth } from './routes.ts'
import { creerServiceAuth } from './service.ts'

export { creerHacheur }
export type { Hacheur }

export interface OptionsAuth {
  /** Le hachage de mots de passe ; bcrypt au coût 12 par défaut (les tests en prennent un moins lent). */
  readonly hacheur?: Hacheur
}

/** Branche les couches de l'authentification : dépôt → service → contrôleur → routes. */
export function monterAuth(
  { base, proprietaire, horloge, config }: Dependances,
  { hacheur = creerHacheur() }: OptionsAuth = {},
): { readonly routes: FastifyPluginAsync; readonly resoudreSession: ResoudreSession } {
  const service = creerServiceAuth({ depot: creerDepotAuth(base, proprietaire), hacheur, horloge })
  return {
    routes: routesAuth(creerControleurAuth(service, config)),
    resoudreSession: service.resoudre,
  }
}
