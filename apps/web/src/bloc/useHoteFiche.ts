import { CorrectionRecue, ErreurApi } from '@janus/contrats'
import type { Manque, MessageAppli, MessagePage, Statut } from '@janus/contrats'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { useBoiteEnvoi } from '../envoi/FournisseurEnvoi.tsx'
import { envoiDeMessage, statutDeReponse } from '../envoi/messages.ts'
import { filtrerMessage } from './filtreMessages.ts'
import type { SerieVerrou } from './verrou.ts'

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

/** Pourquoi la fiche a été refusée à la poignée de main. */
export type CauseRefus = 'schema' | 'version'

/** Ce que l'appli sait d'une réponse du serveur à un message de la page. */
export interface ReponseStatut {
  readonly statut: Statut
  readonly manque: readonly Manque[]
}

/** Ce que la page apprend d'un message refusé : le plafond, la panne de l'IA, ou un simple refus. */
function causeDeRefus(erreur: unknown): {
  code: 'correction_indisponible' | 'plafond_atteint' | 'message_refuse'
  detail: string
} {
  if (erreur instanceof ErreurApi && erreur.status === 429) {
    return { code: 'plafond_atteint', detail: 'plafond atteint' }
  }
  if (erreur instanceof ErreurApi && erreur.status === 503) {
    return { code: 'correction_indisponible', detail: 'correction indisponible' }
  }
  return { code: 'message_refuse', detail: 'message refusé' }
}

/**
 * L'hôte d'une fiche : écoute la fenêtre, filtre ce qui arrive, fait la poignée de main, relaie les
 * messages au serveur et renvoie le statut recalculé à la page. L'appli ne lit jamais l'iframe.
 */
export function useHoteFiche(
  donnees: DonneesFiche,
  iframe: RefObject<HTMLIFrameElement | null>,
  surActivite?: () => void,
  /** Appelé quand une correction est rendue : le statut et les séries ouvertes ont pu changer. */
  surCorrection?: () => void,
) {
  const boite = useBoiteEnvoi()

  const [phase, setPhase] = useState<PhaseFiche>('attente')
  const [chargement, setChargement] = useState(0)
  const [statut, setStatut] = useState<ReponseStatut>({
    statut: donnees.statut,
    manque: donnees.manque,
  })
  const [conflit, setConflit] = useState(false)
  const rappelActivite = useRef(surActivite)
  rappelActivite.current = surActivite
  const rappelCorrection = useRef(surCorrection)
  rappelCorrection.current = surCorrection
  const [refus, setRefus] = useState<CauseRefus | null>(null)
  const [etapeVue, setEtapeVue] = useState<string | null>(null)
  const [etapesVues, setEtapesVues] = useState<readonly string[]>([])
  const [envoyees, setEnvoyees] = useState<Readonly<Record<SerieVerrou, readonly string[]>>>({
    restitution: [],
    consolidation: [],
  })

  // La dernière valeur de chaque donnée, pour que l'écouteur n'ait pas à se réinstaller.
  const dernieres = useRef({ donnees, statut, etat: donnees.etatPage?.etat ?? null })
  dernieres.current.donnees = donnees
  dernieres.current.statut = statut

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

  const envoyerInit = useCallback(() => {
    const { donnees: courantes, etat, statut: courant } = dernieres.current
    vers({
      type: 'etat.init',
      bloc: courantes.bloc,
      version: courantes.version,
      etat,
      statut: courant.statut,
      serie_ouverte: courantes.serieOuverte,
    })
  }, [vers])

  // Une série qui s'ouvre (ou se ferme) pendant que la page est ouverte : la page le sait aussitôt.
  const { restitution: restitutionOuverte, consolidation: consolidationOuverte } =
    donnees.serieOuverte
  const seriesAvant = useRef(`${String(restitutionOuverte)}:${String(consolidationOuverte)}`)
  useEffect(() => {
    const cle = `${String(restitutionOuverte)}:${String(consolidationOuverte)}`
    if (seriesAvant.current === cle) return
    seriesAvant.current = cle
    if (phase === 'prete') envoyerInit()
  }, [restitutionOuverte, consolidationOuverte, phase, envoyerInit])

  // Le serveur a recalculé le statut (après une correction, ou en relisant le bloc).
  const cleStatut = `${donnees.statut}:${JSON.stringify(donnees.manque)}`
  const statutAvant = useRef(cleStatut)
  useEffect(() => {
    if (statutAvant.current === cleStatut) return
    statutAvant.current = cleStatut
    appliquerStatut({
      statut: dernieres.current.donnees.statut,
      manque: dernieres.current.donnees.manque,
    })
  }, [cleStatut, appliquerStatut])

  useEffect(() => {
    const traiter = (message: MessagePage) => {
      const { donnees: courantes } = dernieres.current
      switch (message.type) {
        case 'page.prete':
          setPhase('prete')
          if (courantes.etatPage !== null)
            boite.fixerVersion(courantes.bloc, courantes.etatPage.version)
          envoyerInit()
          return
        default: {
          if (message.type === 'etat.sauver') dernieres.current.etat = message.etat
          if (message.type === 'etape.vue') {
            const vue = message.etape
            setEtapeVue(vue)
            setEtapesVues((avant) => (avant.includes(vue) ? avant : [...avant, vue]))
          }
          if (message.type === 'restitution.demande' && message.relance === '') {
            const { serie, question } = message
            setEnvoyees((avant) =>
              avant[serie].includes(question)
                ? avant
                : { ...avant, [serie]: [...avant[serie], question] },
            )
          }
          const envoi = envoiDeMessage(message, courantes.etatPage?.version ?? 0)
          void boite.ajouter(
            { ...envoi, id: message.id },
            {
              surReponse: (reponse) => {
                if (envoi.route === 'POST /corrections') {
                  vers({ type: 'restitution.correction', ...CorrectionRecue.parse(reponse) })
                  rappelCorrection.current?.()
                  return
                }
                const recalcule = statutDeReponse(envoi.route, reponse)
                if (recalcule !== null) appliquerStatut(recalcule)
              },
              surConflit: () => {
                setConflit(true)
              },
              surRefus: (erreur) => {
                vers({
                  type: 'erreur',
                  ...causeDeRefus(erreur),
                  message_id: message.id,
                })
              },
            },
          )
        }
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
        rappelActivite.current?.()
        traiter(resultat.message)
        return
      }
      console.warn(`[janus] message refusé (${resultat.refus})`)
      // Une fiche qui se présente avec un autre schéma ou une autre version n'est pas ouverte.
      if (
        resultat.pagePrete &&
        (resultat.refus === 'schema' || resultat.refus === 'version') &&
        evenement.source === iframe.current?.contentWindow
      ) {
        setRefus(resultat.refus)
        return
      }
      if (resultat.refus !== 'source_inconnue') {
        vers({ type: 'erreur', code: 'message_refuse', detail: 'message refusé' })
      }
    }

    window.addEventListener('message', surMessage)
    return () => {
      window.removeEventListener('message', surMessage)
    }
  }, [appliquerStatut, boite, envoyerInit, iframe, vers])

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
    conflit,
    refus,
    allerEtape: (etape: string) => {
      vers({ type: 'etape.aller', etape })
    },
    statut,
    etapeVue,
    etapesVues,
    envoyees,
    chargement,
    recharger: () => {
      setChargement((valeur) => valeur + 1)
    },
  }
}
