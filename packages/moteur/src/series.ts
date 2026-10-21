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
 * Les séries que la page propose, d'après les preuves et non d'après le statut affiché : la
 * restitution tant qu'elle n'est pas faite, et de nouveau quand une erreur critique rouvre le bloc.
 * Un statut forcé ne ferme donc jamais une série.
 */
export function seriesOuvertes(etat: Pick<ResultatBloc, 'dates' | 'statut' | 'statutCalcule'>) {
  return { restitution: !auMoinsVu(etat) || etat.statutCalcule === 'a_reprendre' }
}
