import { CorrectionRecue, nomRoute, nouvelId, ROUTES } from '@janus/contrats'
import type { Confiance, SortieRoute } from '@janus/contrats'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useLecture } from '../api/requetes.tsx'
import { instantReel } from '../demo/horlogeDemo.ts'
import { useBoiteEnvoi } from '../envoi/FournisseurEnvoi.tsx'

type Question = SortieRoute<(typeof ROUTES)['GET /questions-debut']>['questions'][number]

export interface Saisie {
  readonly confiance: Confiance
  readonly reponse: string
  readonly colle: boolean
}

/** Où en est une question : à répondre, en attente du tuteur, impossible à corriger, ou corrigée. */
export type EtatQuestion =
  | { readonly phase: 'saisie' }
  | ({ readonly phase: 'attente' } & Saisie)
  | ({ readonly phase: 'indisponible' } & Saisie)
  | ({
      readonly phase: 'corrigee'
      readonly correction: CorrectionRecue
      /** Le bloc d'où vient la question : donné par le serveur seulement après la correction. */
      readonly bloc: string | null
    } & Pick<Saisie, 'confiance' | 'reponse'>)

type Locale = Exclude<EtatQuestion, { phase: 'saisie' }>

const ROUTE_QUESTIONS = ROUTES['GET /questions-debut']

export function useSerie() {
  const boite = useBoiteEnvoi()
  const client = useQueryClient()
  const lecture = useLecture(ROUTE_QUESTIONS, {})
  const [locales, setLocales] = useState<Readonly<Record<string, Locale>>>({})
  const [choisi, setChoisi] = useState<number | null>(null)

  const questions: readonly Question[] = lecture.data?.questions ?? []

  const etatDe = (question: Question): EtatQuestion => {
    const locale = locales[question.id]
    if (locale?.phase === 'corrigee') return { ...locale, bloc: question.deja?.bloc ?? locale.bloc }
    if (locale !== undefined) return locale
    if (question.deja === null) return { phase: 'saisie' }
    return {
      phase: 'corrigee',
      confiance: question.deja.confiance,
      reponse: question.deja.reponse,
      correction: question.deja.correction,
      bloc: question.deja.bloc,
    }
  }

  const etats = questions.map(etatDe)
  const premierSansReponse = etats.findIndex(({ phase }) => phase !== 'corrigee')
  const index = choisi ?? (premierSansReponse === -1 ? questions.length : premierSansReponse)

  function poser(id: string, locale: Locale | null) {
    setLocales((avant) => {
      const reste = Object.fromEntries(Object.entries(avant).filter(([cle]) => cle !== id))
      return locale === null ? reste : { ...reste, [id]: locale }
    })
  }

  function envoyer(question: Question, saisie: Saisie) {
    const id = nouvelId(Date.parse(instantReel()))
    // La question reste affichée jusqu'à « Question suivante », même corrigée.
    setChoisi(index)
    poser(question.id, { phase: 'attente', ...saisie })
    void boite.ajouter(
      {
        id,
        route: 'POST /corrections',
        corps: {
          id,
          serie: 'rappel',
          tentative: 1,
          question: question.id,
          reponse: saisie.reponse,
          confiance: saisie.confiance,
          relance: '',
          support: { colle: saisie.colle, retour_cours: false },
        },
      },
      {
        surReponse: (reponse) => {
          poser(question.id, {
            phase: 'corrigee',
            confiance: saisie.confiance,
            reponse: saisie.reponse,
            correction: CorrectionRecue.parse(reponse),
            bloc: null,
          })
          void client.invalidateQueries({ queryKey: [nomRoute(ROUTE_QUESTIONS), {}] })
        },
        surRefus: () => {
          poser(question.id, { phase: 'indisponible', ...saisie })
        },
      },
    )
  }

  return {
    phase: lecture.isError
      ? ('erreur' as const)
      : lecture.isPending
        ? ('chargement' as const)
        : ('prete' as const),
    recharger: () => void lecture.refetch(),
    questions,
    etats,
    index,
    suivante: () => {
      setChoisi(index + 1)
    },
    envoyer,
  }
}
