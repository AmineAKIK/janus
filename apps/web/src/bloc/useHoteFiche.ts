import type { Manque, MessageAppli, MessagePage, Statut } from '@janus/contrats'
import { ErreurApi, ROUTES } from '@janus/contrats'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { useEcriture } from '../api/requetes.tsx'
import { filtrerMessage } from './filtreMessages.ts'

/** Au bout de ce délai sans `page.prete`, la fiche est jugée muette. */
export const DELAI_FICHE_MS = 10_000

export interface DonneesFiche {
  readonly bloc: string
  readonly version: number
  readonly statut: Statut
  readonly manque: readonly Manque[]
  readonly serieOuverte: { readonly restitution: boolean; readonly consolidation: boolean }
  /** L'état de page sauvegardé et sa version (0 s'il n'y en a pas). */
  readonly etatPage: { readonly version: number; readonly etat: EtatDePage } | null
}

type EtatDePage = Extract<MessagePage, { type: 'etat.sauver' }>['etat']

export type PhaseFiche = 'attente' | 'prete' | 'muette'

/** Ce que l'appli sait d'une réponse du serveur à un message de la page. */
export interface ReponseStatut {
  readonly statut: Statut
  readonly manque: readonly Manque[]
}

/**
 * L'hôte d'une fiche : écoute la fenêtre, filtre ce qui arrive, fait la poignée de main, relaie les
 * messages au serveur et renvoie le statut recalculé à la page. L'appli ne lit jamais l'iframe.
 */
export function useHoteFiche(donnees: DonneesFiche, iframe: RefObject<HTMLIFrameElement | null>) {
  const evenement = useEcriture(ROUTES['POST /evenements'])
  const etatPage = useEcriture(ROUTES['PUT /blocs/:id/etat-page'])
  const erreurs = useEcriture(ROUTES['POST /blocs/:id/erreurs'])

  const [phase, setPhase] = useState<PhaseFiche>('attente')
  const [chargement, setChargement] = useState(0)
  const [statut, setStatut] = useState<ReponseStatut>({
    statut: donnees.statut,
    manque: donnees.manque,
  })
  const [etapeVue, setEtapeVue] = useState<string | null>(null)
  const [etapesVues, setEtapesVues] = useState<readonly string[]>([])

  // La dernière valeur de chaque donnée, pour que l'écouteur n'ait pas à se réinstaller.
  const dernieres = useRef({ donnees, statut, etat: donnees.etatPage?.etat ?? null })
  dernieres.current.donnees = donnees
  dernieres.current.statut = statut
  const versionEtat = useRef(donnees.etatPage?.version ?? 0)
  const mutations = useRef({ evenement, etatPage, erreurs })
  mutations.current = { evenement, etatPage, erreurs }

  const vers = useCallback(
    (message: MessageAppli) => {
      iframe.current?.contentWindow?.postMessage(message, '*')
    },
    [iframe],
  )

  const appliquerStatut = useCallback(
    (reponse: ReponseStatut) => {
      setStatut(reponse)
      dernieres.current.statut = reponse
      vers({ type: 'statut.maj', statut: reponse.statut, manque: [...reponse.manque] })
    },
    [vers],
  )

  useEffect(() => {
    const traiter = (message: MessagePage) => {
      const { evenement, etatPage, erreurs } = mutations.current
      const { donnees: courantes } = dernieres.current
      switch (message.type) {
        case 'page.prete':
          setPhase('prete')
          vers({
            type: 'etat.init',
            bloc: courantes.bloc,
            version: courantes.version,
            etat: dernieres.current.etat,
            statut: dernieres.current.statut.statut,
            serie_ouverte: courantes.serieOuverte,
          })
          return
        case 'etat.sauver':
          dernieres.current.etat = message.etat
          etatPage.mutate(
            {
              params: { id: courantes.bloc },
              corps: { version: versionEtat.current, etat: message.etat },
            },
            {
              onSuccess: ({ version }) => {
                versionEtat.current = version
              },
            },
          )
          return
        case 'bilan.erreurs':
          erreurs.mutate(
            { params: { id: courantes.bloc }, corps: { id: message.id, ids: message.ids } },
            {
              onSuccess: ({ statut, manque }) => {
                appliquerStatut({ statut, manque })
              },
            },
          )
          return
        case 'restitution.demande':
        case 'correction.accord':
          // Les corrections viennent avec la PR-052.
          console.info(`[janus] ${message.type} pas encore pris en charge`)
          return
        default:
          if (message.type === 'etape.vue') {
            const vue = message.etape
            setEtapeVue(vue)
            setEtapesVues((avant) => (avant.includes(vue) ? avant : [...avant, vue]))
          }
          evenement.mutate(
            { corps: message },
            {
              onSuccess: ({ statut }) => {
                if (statut !== null)
                  appliquerStatut({ statut: statut.statut, manque: statut.manque })
              },
              onError: (erreur) => {
                if (!(erreur instanceof ErreurApi)) throw erreur
              },
            },
          )
      }
    }

    const surMessage = (evenement: MessageEvent) => {
      const { bloc, version } = dernieres.current.donnees
      const resultat = filtrerMessage(evenement, {
        fenetreFiche: iframe.current?.contentWindow ?? null,
        bloc,
        version,
      })
      if (resultat.accepte) {
        traiter(resultat.message)
        return
      }
      console.warn(`[janus] message refusé (${resultat.refus})`)
      if (resultat.refus !== 'source_inconnue') {
        vers({ type: 'erreur', code: 'message_refuse', detail: 'message refusé' })
      }
    }

    window.addEventListener('message', surMessage)
    return () => {
      window.removeEventListener('message', surMessage)
    }
  }, [appliquerStatut, iframe, vers])

  // Une fiche qui ne répond pas dans le délai est signalée ; un rechargement repart de zéro.
  useEffect(() => {
    setPhase('attente')
    const minuteur = setTimeout(() => {
      setPhase((actuelle) => (actuelle === 'attente' ? 'muette' : actuelle))
    }, DELAI_FICHE_MS)
    return () => {
      clearTimeout(minuteur)
    }
  }, [chargement])

  return {
    phase,
    statut,
    etapeVue,
    etapesVues,
    chargement,
    recharger: () => {
      setChargement((valeur) => valeur + 1)
    },
  }
}
