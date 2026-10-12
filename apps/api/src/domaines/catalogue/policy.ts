import type { AccesBloc } from '@janus/contrats'

/**
 * Peut-on ouvrir ce bloc ? Libre si tous ses prérequis sont au moins « acquis provisoirement » ;
 * sinon il faut dire qu'on ouvre hors prérequis et donner la raison.
 */
export function peutOuvrir(
  acces: AccesBloc,
  demande: { readonly horsPrerequis: boolean; readonly raison: string | undefined },
): boolean {
  return acces === 'libre' || (demande.horsPrerequis && demande.raison !== undefined)
}
