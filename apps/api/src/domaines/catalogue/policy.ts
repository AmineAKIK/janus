import type { AccesBloc, Statut } from '@janus/contrats'

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

/**
 * Les séries que la page propose. Règle de la démo (à confirmer) : la restitution tant qu'elle n'est
 * pas faite ; la consolidation une fois le bloc vu et le délai passé, jusqu'au bout de la série.
 */
export function serieOuverte(statut: Statut, consolidationTropTot: boolean) {
  return {
    restitution: statut === 'non_commence' || statut === 'en_cours' || statut === 'a_reprendre',
    consolidation: (statut === 'vu' || statut === 'acquis_provisoirement') && !consolidationTropTot,
  }
}
