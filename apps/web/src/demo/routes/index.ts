import type { RoutesDemo } from '../transportDemo.ts'
import { routesCatalogueDemo } from './catalogue.ts'
import type { OptionsCatalogue } from './catalogue.ts'
import { ROUTES_COMPTE_DEMO } from './compte.ts'

export type OptionsRoutesDemo = OptionsCatalogue

/** Les routes de démo ; chaque PR de routes en ajoute (événements, corrections, apprentissage...). */
export function creerRoutesDemo(options: OptionsRoutesDemo): RoutesDemo {
  return Object.fromEntries([...ROUTES_COMPTE_DEMO, ...routesCatalogueDemo(options)])
}
