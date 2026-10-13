import type { ROUTES, SortieRoute } from '@janus/contrats'
import { texteTache } from '../aujourdhui/textesTaches.ts'
import { TEXTES_SEANCE as T, texteEtapeSuivante } from './textes.ts'

export type Aujourdhui = SortieRoute<(typeof ROUTES)['GET /aujourdhui']>
type Tache = Aujourdhui['taches'][number]

/** Le titre court d'un bloc du module ; vide s'il est inconnu. */
export function titreCourtDuBloc(
  blocs: readonly { readonly bloc: string; readonly titre_court: string }[] | undefined,
  code: string,
): string {
  return blocs?.find(({ bloc }) => bloc === code)?.titre_court ?? ''
}

/**
 * Où va le bouton de fin de séance : la première tâche du jour pas encore faite, sauf celles que
 * `ignorer` écarte (la séance qui vient de finir). Sans tâche, il ramène à l'accueil.
 */
export function etapeSuivante(
  aujourdhui: Aujourdhui | undefined,
  ignorer: (tache: Tache) => boolean,
): { readonly lien: string; readonly libelle: string } {
  const suivante = aujourdhui?.taches.find((tache) => !tache.faite && !ignorer(tache))
  if (suivante === undefined) return { lien: '/', libelle: T.etapeSuivante }
  const titreBloc = (code: string) => titreCourtDuBloc(aujourdhui?.module?.blocs, code)
  return {
    lien: suivante.lien,
    libelle: texteEtapeSuivante(texteTache(suivante.tache, { titreBloc, etape: () => null }).titre),
  }
}
