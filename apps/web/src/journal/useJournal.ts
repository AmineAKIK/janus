import { nomRoute, ROUTES } from '@janus/contrats'
import type { SortieRoute, TypeJournal } from '@janus/contrats'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useEcriture, useLectures } from '../api/requetes.tsx'

export type DonneesJournal = SortieRoute<(typeof ROUTES)['GET /journal']>
export type Ligne = DonneesJournal['entrees'][number]

export interface FiltresJournal {
  readonly module?: string
  readonly bloc?: string
  readonly type?: TypeJournal
}

/** Le journal par pages de 50 : « Voir plus » ajoute la page qui suit l'instant donné par la dernière. */
export function useJournal(filtres: FiltresJournal) {
  const client = useQueryClient()
  const [curseurs, setCurseurs] = useState<readonly string[]>([])
  const base = {
    ...(filtres.module === undefined ? {} : { module: filtres.module }),
    ...(filtres.bloc === undefined ? {} : { bloc: filtres.bloc }),
    ...(filtres.type === undefined ? {} : { type: filtres.type }),
  }
  const lectures = useLectures(ROUTES['GET /journal'], [
    { requete: base },
    ...curseurs.map((avant) => ({ requete: { ...base, avant } })),
  ])
  const pages = lectures.flatMap(({ data }) => (data === undefined ? [] : [data]))
  const premiere = pages[0]
  const suivant = pages.at(-1)?.suivant ?? null
  const invalider = () => {
    void client.invalidateQueries({ queryKey: [nomRoute(ROUTES['GET /journal'])] })
  }

  return {
    erreur: lectures.some(({ isError }) => isError),
    recharger: () => {
      void Promise.all(lectures.map(({ refetch }) => refetch()))
    },
    premiere,
    entrees: pages.flatMap(({ entrees }) => entrees),
    suivant,
    chargePlus: lectures.some(({ isFetching }) => isFetching) && pages.length > 0,
    voirPlus: () => {
      if (suivant !== null) setCurseurs((avant) => [...avant, suivant])
    },
    note: useEcriture(ROUTES['POST /journal/notes']),
    modifierNote: useEcriture(ROUTES['PATCH /journal/notes/:id']),
    idee: useEcriture(ROUTES['POST /journal/idees']),
    exportTexte: useEcriture(ROUTES['GET /journal/export.txt']),
    invalider,
  }
}
