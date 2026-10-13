import type { Manifeste, Reglages, Statut } from '@janus/contrats'
import type { Fait } from './faits.ts'
import { comparer } from './ordre.ts'
import { assembler, construireEtat, etapesDe } from './statutEtapes.ts'
import type { ResultatBloc } from './statutEtapes.ts'
import { instantEnMs } from './temps.ts'

export type { CodeManque, Manque, ResultatBloc } from './statutEtapes.ts'
export { compositionReussie } from './statutEtapes.ts'

const STATUTS_SUFFISANTS: ReadonlySet<Statut> = new Set([
  'acquis_provisoirement',
  'acquis',
  'maitrise',
])

/** Un bloc est ouvert librement si tous ses prérequis sont au moins « acquis provisoirement ». */
export function accesBloc(statutsPrerequis: readonly Statut[]): 'libre' | 'raison_requise' {
  return statutsPrerequis.every((statut) => STATUTS_SUFFISANTS.has(statut))
    ? 'libre'
    : 'raison_requise'
}

/** L'ordre des faits d'un bloc : par date, puis par identifiant. */
export function comparerFaits(a: Fait, b: Fait): number {
  return instantEnMs(a.date) - instantEnMs(b.date) || comparer(a.id, b.id)
}

/** Les faits du bloc, triés par date puis identifiant, sans doublon d'identifiant. */
function ordonner(faits: readonly Fait[], bloc: string): Fait[] {
  const vus = new Set<string>()
  return faits
    .filter((fait) => fait.bloc === bloc)
    .map((fait) => ({ fait, ms: instantEnMs(fait.date) }))
    .sort((a, b) => a.ms - b.ms || comparer(a.fait.id, b.fait.id))
    .map(({ fait }) => fait)
    .filter((fait) => {
      const nouveau = !vus.has(fait.id)
      vus.add(fait.id)
      return nouveau
    })
}

/**
 * Calcule le statut d'un bloc depuis tous ses faits : une fonction pure, sans horloge.
 * `maintenant` ne sert qu'à dire ce qui manque (à partir de quand une étape est possible) :
 * le statut ne dépend que des dates des faits, jamais de l'heure de l'appareil.
 * Pour le statut après chaque fait d'un bloc, `SuiviBloc` évite de tout recalculer à chaque fait.
 */
export function calculerBloc(
  faits: readonly Fait[],
  manifeste: Manifeste,
  reglages: Reglages,
  maintenant: string,
): ResultatBloc {
  const etat = construireEtat(ordonner(faits, manifeste.bloc), manifeste, reglages)
  return assembler(etapesDe(etat, maintenant), manifeste, reglages, maintenant)
}
