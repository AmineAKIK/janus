import { ROUTES_APPRENTISSAGE } from './apprentissage.ts'
import { ROUTES_BLOCS } from './blocs.ts'
import { ROUTES_CATALOGUE } from './catalogue.ts'
import { ROUTES_COMPTE } from './compte.ts'
import { ROUTES_CORRECTIONS } from './corrections.ts'
import { ROUTES_REGLAGES } from './reglages.ts'
import { ROUTES_SUIVI } from './suivi.ts'

export * from './commun.ts'
export * from './routes.ts'
export * from './compte.ts'
export * from './catalogue.ts'
export * from './blocs.ts'
export * from './corrections.ts'
export * from './apprentissage.ts'
export * from './suivi.ts'
export * from './reglages.ts'

/** Toutes les routes de l'API, par « MÉTHODE chemin ». */
export const ROUTES = {
  ...ROUTES_COMPTE,
  ...ROUTES_CATALOGUE,
  ...ROUTES_BLOCS,
  ...ROUTES_CORRECTIONS,
  ...ROUTES_APPRENTISSAGE,
  ...ROUTES_SUIVI,
  ...ROUTES_REGLAGES,
}
export type CleRoute = keyof typeof ROUTES
