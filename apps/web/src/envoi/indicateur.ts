import { accorder } from '../catalogue/calculs.ts'
import type { EntreeEnvoi } from './stockageEnvoi.ts'

/** Le bloc d'une entrée : son paramètre d'URL ou le bloc de son message. */
export function blocDeEntree(entree: EntreeEnvoi): string | null {
  const id = entree.params?.['id']
  if (entree.route.includes('/blocs/') && id !== undefined) return id
  const { corps } = entree
  if (
    typeof corps === 'object' &&
    corps !== null &&
    'bloc' in corps &&
    typeof corps.bloc === 'string'
  ) {
    return corps.bloc
  }
  return null
}

export const ROUTE_ETAT_PAGE = 'PUT /blocs/:id/etat-page'

/** Ce qui attend pour un bloc, l'état de la page mis à part (il se renvoie tout seul). */
export function reponsesGardees(
  entrees: readonly EntreeEnvoi[],
  bloc: string,
): readonly EntreeEnvoi[] {
  return entrees.filter(
    (entree) => entree.route !== ROUTE_ETAT_PAGE && blocDeEntree(entree) === bloc,
  )
}

export function textesEnvoi(nombre: number) {
  return `En attente de réseau · ${accorder(nombre, 'réponse gardée', 'réponses gardées')}`
}

export type EtatIndicateur = 'enregistre' | 'attente'

/**
 * L'état de l'indicateur : « attente » quand le réseau manque et que des réponses sont gardées,
 * « enregistré » quand rien n'attend pour ce bloc ; en ligne avec des messages en route, il garde
 * son état précédent.
 */
export function etatIndicateur(entree: {
  readonly reseauManque: boolean
  readonly gardees: number
  readonly enAttente: number
  readonly precedent: EtatIndicateur
}): EtatIndicateur {
  if (entree.reseauManque && entree.gardees > 0) return 'attente'
  if (entree.enAttente === 0) return 'enregistre'
  return entree.precedent
}

/** La dernière réponse de restitution gardée, si une demande de correction attend. */
export function derniereReponseGardee(
  entrees: readonly EntreeEnvoi[],
  bloc: string,
): string | null {
  const demandes = entrees.filter(
    (entree) => entree.route === 'POST /corrections' && blocDeEntree(entree) === bloc,
  )
  const { corps } = demandes.at(-1) ?? {}
  return typeof corps === 'object' &&
    corps !== null &&
    'reponse' in corps &&
    typeof corps.reponse === 'string'
    ? corps.reponse
    : null
}
