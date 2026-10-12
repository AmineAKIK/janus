import type { Statut } from '@janus/contrats'
import type { ResultatBloc } from './statut.ts'

const STATUTS_VUS: ReadonlySet<Statut> = new Set([
  'vu',
  'acquis_provisoirement',
  'acquis',
  'maitrise',
])

/**
 * Vrai dès que la restitution est faite, même si le statut affiché est « à reprendre » ou a été forcé
 * plus bas ; vrai aussi quand Amine force un statut d'au moins « vu ».
 */
export function auMoinsVu(etat: Pick<ResultatBloc, 'dates' | 'statut'>): boolean {
  return etat.dates.vu !== null || STATUTS_VUS.has(etat.statut)
}

/**
 * Les séries que la page propose, d'après les preuves et non d'après le statut affiché :
 * - la restitution tant qu'elle n'est pas faite, et de nouveau quand une erreur critique rouvre le bloc ;
 * - la consolidation une fois le bloc vu et le délai passé, tant que le bloc n'est pas « acquis ».
 * Un statut forcé ne ferme donc jamais une série.
 */
export function seriesOuvertes(
  etat: Pick<ResultatBloc, 'dates' | 'statut' | 'statutCalcule' | 'manque'>,
) {
  const tropTot = etat.manque.some(({ code }) => code === 'consolidation_trop_tot')
  const vu = auMoinsVu(etat)
  return {
    restitution: !vu || etat.statutCalcule === 'a_reprendre',
    consolidation: vu && etat.dates.acquis === null && !tropTot,
  }
}
