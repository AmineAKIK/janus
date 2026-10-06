import type { Reglages } from '@janus/contrats'
import type { Fait } from '../faits.ts'
import { dansLaPeriode } from './periode.ts'
import type { Periode } from './periode.ts'

export interface ErreurRecurrente {
  readonly erreur: string
  readonly libelle: string
  /** Combien de fois elle a été ouverte. */
  readonly nombre: number
  readonly blocs: readonly string[]
  /** Encore ouverte dans au moins un bloc. */
  readonly ouverte: boolean
}

/** Les erreurs critiques cochées, les plus fréquentes d'abord (à égalité, par identifiant). */
export function erreursRecurrentes(
  faits: readonly Fait[],
  libelles: ReadonlyMap<string, string>,
  ouvertes: ReadonlySet<string>,
  periode: Periode,
  maintenant: string,
  reglages: Pick<Reglages, 'fuseau' | 'heureBascule'>,
): ErreurRecurrente[] {
  const parErreur = new Map<string, { nombre: number; blocs: Set<string> }>()
  for (const fait of faits) {
    if (fait.type !== 'erreur_cochee' || !dansLaPeriode(fait.date, periode, maintenant, reglages)) {
      continue
    }
    const total = parErreur.get(fait.erreur) ?? { nombre: 0, blocs: new Set<string>() }
    total.nombre += 1
    total.blocs.add(fait.bloc)
    parErreur.set(fait.erreur, total)
  }
  return [...parErreur]
    .map(([erreur, { nombre, blocs }]) => ({
      erreur,
      libelle: libelles.get(erreur) ?? erreur,
      nombre,
      blocs: [...blocs].sort(),
      ouverte: ouvertes.has(erreur),
    }))
    .sort((a, b) => b.nombre - a.nombre || (a.erreur < b.erreur ? -1 : 1))
}
