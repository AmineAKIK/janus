import type { Statut } from '@janus/contrats'
import { ROUTES } from '@janus/contrats'
import { useLecture, useLectures } from '../api/requetes.tsx'

export interface ModuleChiffre {
  readonly id: string
  readonly ordre: number
  readonly titre: string
  readonly importe: boolean
  /** Le statut de chaque bloc du module, dans l'ordre du plan. */
  readonly statuts: readonly Statut[]
}

export type EtatFormation =
  | { readonly phase: 'chargement' }
  | { readonly phase: 'erreur'; readonly reessayer: () => void }
  | { readonly phase: 'pret'; readonly modules: readonly ModuleChiffre[] }

/** Les modules d'une formation avec le statut de chacun de leurs blocs (calculés par le serveur). */
export function useFormation(formationId: string): EtatFormation {
  const modules = useLecture(ROUTES['GET /formations/:id/modules'], { params: { id: formationId } })
  const importes = (modules.data?.modules ?? []).filter(({ importe }) => importe)
  const blocs = useLectures(
    ROUTES['GET /modules/:id/blocs'],
    importes.map(({ id }) => ({ params: { id } })),
  )

  if (modules.isError) return { phase: 'erreur', reessayer: () => void modules.refetch() }
  const enErreur = blocs.find(({ isError }) => isError)
  if (enErreur !== undefined) return { phase: 'erreur', reessayer: () => void enErreur.refetch() }
  if (modules.data === undefined || blocs.some(({ data }) => data === undefined)) {
    return { phase: 'chargement' }
  }

  return {
    phase: 'pret',
    modules: [...modules.data.modules]
      .sort((a, b) => a.ordre - b.ordre)
      .map(({ id, ordre, titre, importe }) => {
        const index = importes.findIndex((module) => module.id === id)
        return {
          id,
          ordre,
          titre,
          importe,
          statuts: (blocs[index]?.data?.blocs ?? []).map(({ statut }) => statut),
        }
      }),
  }
}
