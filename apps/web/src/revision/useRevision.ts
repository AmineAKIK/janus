import { nomRoute, nouvelId, ROUTES } from '@janus/contrats'
import type { NoteCarte, SortieRoute } from '@janus/contrats'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useLecture } from '../api/requetes.tsx'
import { instantReel } from '../demo/horlogeDemo.ts'
import { useBoiteEnvoi } from '../envoi/FournisseurEnvoi.tsx'

export type Carte = SortieRoute<(typeof ROUTES)['GET /cartes/dues']>['dues'][number]

export interface Revue {
  readonly carte: Carte
  readonly note: NoteCarte
}

/** Pendant ce délai, la note reste annulable : elle n'est envoyée qu'après. */
export const DELAI_ANNULATION_MS = 5000

const ROUTE_DUES = ROUTES['GET /cartes/dues']

interface EnAttente {
  readonly revue: Revue
  readonly id: string
  readonly minuteur: ReturnType<typeof setTimeout>
}

export function useRevision() {
  const boite = useBoiteEnvoi()
  const client = useQueryClient()
  const lecture = useLecture(ROUTE_DUES, {})
  const [file, setFile] = useState<readonly Carte[] | null>(null)
  const [position, setPosition] = useState(0)
  const [verso, setVerso] = useState(false)
  const [revues, setRevues] = useState<readonly Revue[]>([])
  const [annulable, setAnnulable] = useState<Revue | null>(null)
  const [plusTard, setPlusTard] = useState(false)
  const enAttente = useRef<EnAttente | null>(null)

  // La file est figée à la première lecture : les cartes revues ne changent pas sous les yeux.
  if (file === null && lecture.data !== undefined) {
    setFile([...lecture.data.dues, ...lecture.data.nouvelles])
  }

  function envoyer({ revue, id }: Pick<EnAttente, 'revue' | 'id'>) {
    void boite.ajouter(
      {
        id,
        route: 'POST /cartes/:id/note',
        params: { id: revue.carte.id },
        corps: { id, note: revue.note },
      },
      {
        surReponse: () => {
          void client.invalidateQueries({ queryKey: [nomRoute(ROUTES['GET /aujourdhui']), {}] })
          void client.invalidateQueries({ queryKey: [nomRoute(ROUTE_DUES), {}] })
        },
      },
    )
  }

  /** Envoie tout de suite la note qui attendait la fin du délai d'annulation. */
  function vider() {
    const courante = enAttente.current
    if (courante === null) return
    clearTimeout(courante.minuteur)
    enAttente.current = null
    setAnnulable(null)
    envoyer(courante)
  }

  const viderAuDemontage = useRef(vider)
  viderAuDemontage.current = vider
  useEffect(
    () => () => {
      viderAuDemontage.current()
    },
    [],
  )

  const cartes = file ?? []
  const carte = cartes[position]

  function noter(note: NoteCarte) {
    if (carte === undefined) return
    vider()
    const revue = { carte, note }
    const id = nouvelId(Date.parse(instantReel()))
    enAttente.current = {
      revue,
      id,
      minuteur: setTimeout(vider, DELAI_ANNULATION_MS),
    }
    setAnnulable(revue)
    setRevues((avant) => [...avant, revue])
    setPosition((avant) => avant + 1)
    setVerso(false)
    setPlusTard(false)
  }

  function annuler() {
    const courante = enAttente.current
    if (courante === null) return
    clearTimeout(courante.minuteur)
    enAttente.current = null
    setAnnulable(null)
    setRevues((avant) => avant.slice(0, -1))
    setPosition((avant) => avant - 1)
    setVerso(false)
    setPlusTard(false)
  }

  /** La dernière note de chaque carte : c'est elle qui compte pour la suite de la séance. */
  const dernieres = new Map(revues.map((revue) => [revue.carte.id, revue]))
  const aRevoir = [...dernieres.values()].filter(({ note }) => note === 'a_revoir')

  function revoirMaintenant() {
    vider()
    setFile([...cartes, ...aRevoir.map(({ carte: revue }) => revue)])
  }

  return {
    phase: lecture.isError
      ? ('erreur' as const)
      : file === null
        ? ('chargement' as const)
        : ('prete' as const),
    recharger: () => {
      void lecture.refetch()
    },
    cartes,
    carte,
    position,
    nouvelles: cartes.filter(({ nouvelle }) => nouvelle).length,
    verso,
    montrerReponse: () => {
      setVerso(true)
    },
    prochaine: lecture.data?.prochaine ?? null,
    revues: [...dernieres.values()],
    aRevoir,
    plusTard,
    reporter: () => {
      setPlusTard(true)
    },
    annulable,
    noter,
    annuler,
    vider,
    revoirMaintenant,
  }
}
