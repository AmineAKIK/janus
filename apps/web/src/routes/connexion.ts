import type { Routeur } from './arbre.tsx'

/** Mène à la connexion en gardant la page demandée, pour y revenir ensuite. */
export function allerALaConnexion(routeur: Routeur): void {
  const { pathname, href } = routeur.state.location
  if (pathname === '/connexion') return
  void routeur.navigate({ to: '/connexion', search: { retour: href } })
}
