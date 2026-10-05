import type { RoutesDemo } from '../transportDemo.ts'
import { ROUTES_BLOCS_DEMO } from './blocs.ts'
import { routesCatalogueDemo } from './catalogue.ts'
import type { OptionsCatalogue } from './catalogue.ts'
import { ROUTES_COMPTE_DEMO } from './compte.ts'
import { routesCorrectionsDemo } from './corrections.ts'
import type { OptionsCorrections } from './corrections.ts'

export type OptionsRoutesDemo = OptionsCatalogue & OptionsCorrections

/** Les routes de démo ; chaque PR d'écran complète celles qu'elle utilise. */
export function creerRoutesDemo(options: OptionsRoutesDemo): RoutesDemo {
  return Object.fromEntries([
    ...ROUTES_COMPTE_DEMO,
    ...routesCatalogueDemo(options),
    ...ROUTES_BLOCS_DEMO,
    ...routesCorrectionsDemo(options),
  ])
}
