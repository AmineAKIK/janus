import type { Fait } from './faits.ts'

/**
 * Les faits rangés par bloc, chacun dans son ordre d'arrivée ; les blocs sont dans l'ordre où leur
 * premier fait apparaît. Un seul passage, là où filtrer les faits bloc par bloc en demande un par bloc.
 */
export function faitsParBloc(faits: readonly Fait[]): Map<string, Fait[]> {
  const parBloc = new Map<string, Fait[]>()
  for (const fait of faits) {
    const duBloc = parBloc.get(fait.bloc)
    if (duBloc === undefined) parBloc.set(fait.bloc, [fait])
    else duBloc.push(fait)
  }
  return parBloc
}
