import { ROUTES } from '@janus/contrats'
import { definir } from './definir.ts'

/** Les réglages : la démo les lit ; les modifier viendra avec l'écran des paramètres. */
export const ROUTES_REGLAGES_DEMO = [
  definir(ROUTES['GET /reglages'], ({ magasin }) => magasin.lire().reglages),
]
