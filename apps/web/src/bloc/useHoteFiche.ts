import { CorrectionRecue, ErreurApi, nouvelId } from '@janus/contrats'
import type { Manque, MessageAppli, MessagePage, Niveau, Statut } from '@janus/contrats'
import { lireTheme } from '@janus/ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { instantReel } from '../horloge.ts'
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

/** Une erreur critique que l'IA a repérée dans une réponse, en attente de la décision d'Amine. */
export interface PropositionErreur {
  readonly erreur: string
  readonly correction: string
  readonly reponse: string
}

/** Une correction reçue de la fiche, avec la réponse qui l'a déclenchée. */
export interface CorrectionSuivie {
  readonly correction: CorrectionRecue
  readonly reponse: string
  /** Vrai uniquement si cette réponse a été donnée après « Revoir le cours ». */
  readonly retourCours: boolean
}

/** Ce que l'appli sait d'une réponse du serveur à un message de la page. */
export interface ReponseStatut {
  readonly statut: Statut
  readonly manque: readonly Manque[]
}

/** Ce que la page apprend d'un message refusé : le plafond, la panne de l'IA, ou un simple refus. */
export function causeDeRefus(erreur: unknown): {
  code: 'correction_indisponible' | 'plafond_atteint' | 'message_refuse'
  detail: string
} {
  if (erreur instanceof ErreurApi && erreur.code === 'budget_atteint') {
    return { code: 'plafond_atteint', detail: 'plafond atteint' }
  }
  // Trop de requêtes d'un coup (429) ou IA en panne (503) : le plafond n'est pas en cause, on peut réessayer.
  if (erreur instanceof ErreurApi && (erreur.status === 429 || erreur.status === 503)) {
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
  /** L'étape à montrer à l'ouverture (le lien « partie du bloc concernée »), une seule fois. */
  etapeDemandee?: string,
) {
  const boite = useBoiteEnvoi()
  const etapeAMontrer = useRef(etapeDemandee)

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
  const [hauteur, setHauteur] = useState<number | null>(null)
  const [etapeVue, setEtapeVue] = useState<string | null>(null)
  const [etapesVues, setEtapesVues] = useState<readonly string[]>([])
  const [propositions, setPropositions] = useState<readonly PropositionErreur[]>([])
  const [corrections, setCorrections] = useState<readonly CorrectionSuivie[]>([])
  const [correctionsTranchees, setCorrectionsTranchees] = useState<readonly string[]>([])
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
      theme: lireTheme(),
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
          // etat.init ne porte pas ce qui manque : la fiche le reçoit aussitôt (erreurs ouvertes du bilan).
          vers({
            type: 'statut.maj',
            statut: dernieres.current.statut.statut,
            manque: [...dernieres.current.statut.manque],
          })
          if (etapeAMontrer.current !== undefined) {
            vers({ type: 'etape.aller', etape: etapeAMontrer.current })
            etapeAMontrer.current = undefined
          }
          return
        case 'lien.ouvrir':
          // L'appli seule ouvre l'adresse (nouvel onglet, sans lien avec Janus) ; rien ne part au serveur.
          window.open(message.url, '_blank', 'noopener,noreferrer')
          return
        case 'page.taille':
          // L'iframe prend la hauteur de son contenu : un seul défilement, celui de la page.
          setHauteur(message.hauteur)
          return
        case 'page.haut': {
          // Nouvel écran de la fiche : son haut revient à l'écran s'il était passé au-dessus. On
          // regarde deux images plus tard : la page a d'abord affiché l'étape (un encart en moins
          // au-dessus de la fiche la déplace).
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const cadre = iframe.current
              if (cadre !== null && cadre.getBoundingClientRect().top < 0) {
                cadre.scrollIntoView({ block: 'start' })
              }
            })
          })
          return
        }
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
          const demande = message.type === 'restitution.demande' ? message : null
          const reponseDonnee = demande?.reponse ?? ''
          const envoi = envoiDeMessage(message, courantes.etatPage?.version ?? 0)
          void boite.ajouter(
            { ...envoi, id: message.id },
            {
              surReponse: (reponse) => {
                if (envoi.route === 'POST /corrections') {
                  const recue = CorrectionRecue.parse(reponse)
                  vers({ type: 'restitution.correction', ...recue })
                  if (demande !== null) {
                    setCorrections((avant) =>
                      avant.some(({ correction }) => correction.id === recue.id)
                        ? avant
                        : [
                            ...avant,
                            {
                              correction: recue,
                              reponse: demande.reponse,
                              retourCours: demande.support.retour_cours,
                            },
                          ],
                    )
                  }
                  setPropositions((avant) => [
                    ...avant,
                    ...recue.erreurs_critiques
                      .filter(
                        (erreur) => !avant.some((proposition) => proposition.erreur === erreur),
                      )
                      .map((erreur) => ({ erreur, correction: recue.id, reponse: reponseDonnee })),
                  ])
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
        // La taille de la page change aussi sans geste d'Amine (chargement, rotation) : ce n'est pas de l'activité.
        if (resultat.message.type !== 'page.taille') rappelActivite.current?.()
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
    setHauteur(null)
    const minuteur = setTimeout(() => {
      setPhase((actuelle) => (actuelle === 'attente' ? 'muette' : actuelle))
    }, DELAI_FICHE_MS)
    return () => {
      clearTimeout(minuteur)
    }
  }, [chargement])

  /** Enregistre la décision d'Amine sur une correction non vérifiée. */
  const trancherCorrection = (
    suivie: CorrectionSuivie,
    compte: boolean,
    niveau?: Niveau,
    raison?: string,
  ) => {
    const correction = suivie.correction.id
    setCorrectionsTranchees((avant) =>
      avant.includes(correction) ? avant : [...avant, correction],
    )
    const id = nouvelId(Date.parse(instantReel()))
    const route = 'POST /corrections/:id/trancher'
    const corps =
      niveau === undefined ? { id, compte } : { id, compte, niveau, raison: raison?.trim() ?? '' }
    void boite.ajouter(
      { id, route, params: { id: correction }, corps },
      {
        surReponse: (reponse) => {
          const recalcule = statutDeReponse(route, reponse)
          if (recalcule !== null) appliquerStatut(recalcule)
        },
        surRefus: () => {
          setCorrectionsTranchees((avant) =>
            avant.filter((identifiant) => identifiant !== correction),
          )
        },
      },
    )
  }

  /** Confirmer une erreur de l'IA l'ouvre ; la rejeter garde la décision dans l'historique. */
  const trancherErreur = (proposition: PropositionErreur, decision: 'confirmee' | 'rejetee') => {
    setPropositions((avant) => avant.filter((autre) => autre !== proposition))
    const { donnees: courantes } = dernieres.current
    const id = nouvelId(Date.parse(instantReel()))
    const route = 'POST /blocs/:id/erreurs'
    void boite.ajouter(
      {
        id,
        route,
        params: { id: courantes.bloc },
        corps: {
          id,
          erreur: proposition.erreur,
          correction: proposition.correction,
          decision,
        },
      },
      {
        surReponse: (reponse) => {
          const recalcule = statutDeReponse(route, reponse)
          if (recalcule !== null) appliquerStatut(recalcule)
        },
        // Le serveur a refusé : la décision reste à prendre, la proposition revient.
        surRefus: () => {
          setPropositions((avant) =>
            avant.includes(proposition) ? avant : [...avant, proposition],
          )
        },
      },
    )
  }

  return {
    phase,
    propositions,
    correctionsAVerifier: corrections.filter(
      ({ correction }) =>
        correction.certitude === 'non_verifie' && !correctionsTranchees.includes(correction.id),
    ),
    reponsesApresRetourCours: corrections.filter(({ retourCours }) => retourCours),
    trancherCorrection,
    trancherErreur,
    conflit,
    refus,
    allerEtape: (etape: string) => {
      vers({ type: 'etape.aller', etape })
    },
    statut,
    /** La hauteur du contenu de la fiche, `null` tant qu'elle ne l'a pas donnée. */
    hauteur,
    etapeVue,
    etapesVues,
    envoyees,
    chargement,
    recharger: () => {
      setChargement((valeur) => valeur + 1)
    },
  }
}
