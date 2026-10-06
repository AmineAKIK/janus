import type { Reglages } from '@janus/contrats'
import { ajouterJours, jourDe } from '../temps.ts'

export type Periode = '7j' | '30j' | 'tout'

const JOURS: Readonly<Record<Exclude<Periode, 'tout'>, number>> = { '7j': 7, '30j': 30 }

/**
 * Une date est dans la période si son jour (avec la bascule) est l'un des N derniers jours, le jour
 * courant compris. « Tout » garde toutes les dates.
 */
export function dansLaPeriode(
  date: string,
  periode: Periode,
  maintenant: string,
  reglages: Pick<Reglages, 'fuseau' | 'heureBascule'>,
): boolean {
  if (periode === 'tout') return true
  const jour = (instant: string) => jourDe(instant, reglages.fuseau, reglages.heureBascule)
  return jour(date) > ajouterJours(jour(maintenant), -JOURS[periode])
}
