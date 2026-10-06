import type { RoutesDemo } from '../transportDemo.ts'
import { ROUTES_AUJOURDHUI_DEMO } from './aujourdhui.ts'
import { ROUTES_BLOCS_DEMO } from './blocs.ts'
import { ROUTES_CARTES_DEMO } from './cartes.ts'
import { routesCatalogueDemo } from './catalogue.ts'
import type { OptionsCatalogue } from './catalogue.ts'
import { ROUTES_COMPTE_DEMO } from './compte.ts'
import { ROUTES_DONNEES_DEMO } from './donnees.ts'
import { ROUTES_JOURNAL_DEMO } from './journal.ts'
import { ROUTES_TABLEAU_DE_BORD_DEMO } from './tableauDeBord.ts'
import { ROUTES_QUESTIONS_DEMO } from './questions.ts'
import { ROUTES_REGLAGES_DEMO } from './reglages.ts'
import { routesCorrectionsDemo } from './corrections.ts'
import type { OptionsCorrections } from './corrections.ts'
import { routesVerificationsDemo } from './verifications.ts'

export type OptionsRoutesDemo = OptionsCatalogue & OptionsCorrections

/** Les routes de démo ; chaque PR d'écran complète celles qu'elle utilise. */
export function creerRoutesDemo(options: OptionsRoutesDemo): RoutesDemo {
  return Object.fromEntries([
    ...ROUTES_COMPTE_DEMO,
    ...routesCatalogueDemo(options),
    ...ROUTES_BLOCS_DEMO,
    ...ROUTES_AUJOURDHUI_DEMO,
    ...ROUTES_QUESTIONS_DEMO,
    ...ROUTES_CARTES_DEMO,
    ...routesCorrectionsDemo(options),
    ...routesVerificationsDemo(options),
    ...ROUTES_REGLAGES_DEMO,
    ...ROUTES_DONNEES_DEMO,
    ...ROUTES_TABLEAU_DE_BORD_DEMO,
    ...ROUTES_JOURNAL_DEMO,
  ])
}
