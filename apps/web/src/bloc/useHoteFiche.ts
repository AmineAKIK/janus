import { CorrectionRendue, ErreurApi, nouvelId, pourLaPage } from '@janus/contrats'
import type {
  Avancement,
  Manque,
  MessageAppli,
  MessagePage,
  Niveau,
  PratiqueDuBloc,
  Statut,
} from '@janus/contrats'
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
/** Après le départ de la fiche, le temps pendant lequel son dernier `etat.sauver` est encore reçu. */
export const DELAI_DERNIER_ETAT_MS = 2000

export interface DonneesFiche {
  readonly bloc: string
  readonly version: number
  readonly statut: Statut
  readonly manque: readonly Manque[]
  /** L'avancement du bloc d'après les faits enregistrés : ce que le fil d'étapes coche. */
  readonly avancement: Avancement
  /** La pratique du bloc que le serveur garde : la page en relit ses items, sans en garder de copie. */
  readonly pratique: PratiqueDuBloc
  readonly serieOuverte: { readonly restitution: boolean }
  /** L'état de page sauvegardé et sa version (0 s'il n'y en a pas). */
  readonly etatPage: { readonly version: number; readonly etat: EtatDePage } | null
  /** Les séries d'aisance réussies que le serveur garde : la page y relit ses niveaux. */
  readonly aisanceReussies: readonly { readonly le: string; readonly duree_s: number }[]
}

/** Le gabarit garde le bilan envoyé sous la clé `bilan` de son état : sa présence dit qu'un bilan est parti. */
function bilanDansLEtat(etat: EtatDePage | undefined): boolean {
  const bilan = etat?.['bilan']
  return typeof bilan === 'object' && bilan !== null
}

type EtatDePage = Extract<MessagePage, { type: 'etat.sauver' }>['etat']

export type PhaseFiche = 'attente' | 'prete' | 'muette'

/** Pourquoi la fiche a été refusée à la poignée de main. */
export type CauseRefus = 'schema' | 'version'

/** Une erreur critique que l'IA a repérée dans une réponse, en attente de la décision d'Amine. */
export interface PropositionErreur {
  readonly erreur: string
  readonly correction: string
  /** La question dont la correction a repéré l'erreur : la fiche la retire de son bilan si elle est rejetée. */
  readonly question: string
  readonly reponse: string
}

/** Une correction reçue de la fiche, avec la réponse qui l'a déclenchée. */
export interface CorrectionSuivie {
  readonly correction: CorrectionRendue
  readonly reponse: string
  /** Vrai uniquement si cette réponse a été donnée après « Revoir le cours ». */
  readonly retourCours: boolean
}

/** Ce que l'appli sait d'une réponse du serveur à un message de la page. */
export interface ReponseStatut {
  readonly statut: Statut
  readonly manque: readonly Manque[]
  readonly avancement: Avancement
  readonly pratique: PratiqueDuBloc
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
  // Une erreur interne du serveur : la réponse attend, à renvoyer une fois la panne réparée.
  if (erreur instanceof ErreurApi && erreur.status === 500) {
    return { code: 'correction_indisponible', detail: 'erreur du serveur' }
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
  /**
   * Appelé quand le serveur a pu rouvrir ou fermer une série : une correction rendue, ou un bilan
   * envoyé (une erreur cochée rouvre la restitution). L'appli relit alors le bloc.
   */
  surSeriesChangees?: () => void,
  /** L'étape à montrer à l'ouverture (le lien « partie du bloc concernée »), une seule fois. */
  etapeDemandee?: string,
) {
  const boite = useBoiteEnvoi()
  const etapeAMontrer = useRef(etapeDemandee)

  const [phase, setPhase] = useState<PhaseFiche>('attente')
  const [chargement, setChargement] = useState(0)
  /**
   * Les `etat.sauver` à laisser tomber : avant `page.prete` (la fiche ne sauve qu'après son init ; un
   * message plus tôt vient d'une fiche qui n'est plus la nôtre), et après « Recommencer » tant que la
   * fiche ne s'est pas rechargée. La fiche encore affichée groupe ses sauvegardes : la dernière peut
   * arriver dans la foulée avec l'ancien état et prendrait la place de l'état vide dans la boîte
   * d'envoi (même clé). La fiche se recharge après la réponse : un `page.prete` neuf rouvre la porte.
   */
  const sauvegardesIgnorees = useRef(true)
  const [statut, setStatut] = useState<ReponseStatut>({
    statut: donnees.statut,
    manque: donnees.manque,
    avancement: donnees.avancement,
    pratique: donnees.pratique,
  })
  const [bilanFait, setBilanFait] = useState(() => bilanDansLEtat(donnees.etatPage?.etat))
  const [conflit, setConflit] = useState(false)
  const rappelActivite = useRef(surActivite)
  rappelActivite.current = surActivite
  const rappelSeries = useRef(surSeriesChangees)
  rappelSeries.current = surSeriesChangees
  const [refus, setRefus] = useState<CauseRefus | null>(null)
  const [hauteur, setHauteur] = useState<number | null>(null)
  const [etapeVue, setEtapeVue] = useState<string | null>(null)
  const [etapesVues, setEtapesVues] = useState<readonly string[]>([])
  const [propositions, setPropositions] = useState<readonly PropositionErreur[]>([])
  const [corrections, setCorrections] = useState<readonly CorrectionSuivie[]>([])
  const [correctionsTranchees, setCorrectionsTranchees] = useState<readonly string[]>([])
  const [envoyees, setEnvoyees] = useState<Readonly<Record<SerieVerrou, readonly string[]>>>({
    restitution: [],
  })

  // La dernière valeur de chaque donnée, pour que l'écouteur n'ait pas à se réinstaller.
  const dernieres = useRef({ donnees, statut, etat: donnees.etatPage?.etat ?? null })
  /** La fenêtre de la fiche qui a parlé en dernier, gardée pour son dernier message au départ. */
  const fenetreFiche = useRef<MessageEventSource | null>(null)
  const generationEcouteur = useRef(0)
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
      vers({
        type: 'statut.maj',
        statut: reponse.statut,
        manque: [...reponse.manque],
        pratique: reponse.pratique,
      })
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
      aisance: [...courantes.aisanceReussies],
      pratique: courant.pratique,
      theme: lireTheme(),
    })
  }, [vers])

  // Une série qui s'ouvre (ou se ferme) pendant que la page est ouverte : la page le sait aussitôt.
  const { restitution: restitutionOuverte } = donnees.serieOuverte
  const serieAvant = useRef(restitutionOuverte)
  useEffect(() => {
    if (serieAvant.current === restitutionOuverte) return
    serieAvant.current = restitutionOuverte
    if (phase === 'prete') envoyerInit()
  }, [restitutionOuverte, phase, envoyerInit])

  // Le serveur a recalculé le statut (après une correction, ou en relisant le bloc).
  const cleStatut = `${donnees.statut}:${JSON.stringify(donnees.manque)}:${JSON.stringify(donnees.avancement)}:${JSON.stringify(donnees.pratique)}`
  const statutAvant = useRef(cleStatut)
  useEffect(() => {
    if (statutAvant.current === cleStatut) return
    statutAvant.current = cleStatut
    appliquerStatut({
      statut: dernieres.current.donnees.statut,
      manque: dernieres.current.donnees.manque,
      avancement: dernieres.current.donnees.avancement,
      pratique: dernieres.current.donnees.pratique,
    })
  }, [cleStatut, appliquerStatut])

  useEffect(() => {
    const traiter = (message: MessagePage) => {
      const { donnees: courantes } = dernieres.current
      switch (message.type) {
        case 'page.prete':
          sauvegardesIgnorees.current = false
          setPhase('prete')
          if (courantes.etatPage !== null)
            boite.fixerVersion(courantes.bloc, courantes.etatPage.version)
          envoyerInit()
          // etat.init ne porte pas ce qui manque : la fiche le reçoit aussitôt (erreurs ouvertes du bilan).
          vers({
            type: 'statut.maj',
            statut: dernieres.current.statut.statut,
            manque: [...dernieres.current.statut.manque],
            pratique: dernieres.current.statut.pratique,
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
          if (message.type === 'etat.sauver' && sauvegardesIgnorees.current) return
          if (message.type === 'etat.sauver') dernieres.current.etat = message.etat
          if (message.type === 'bilan.erreurs') setBilanFait(true)
          if (message.type === 'etape.vue') {
            const vue = message.etape
            setEtapeVue(vue)
            setEtapesVues((avant) => (avant.includes(vue) ? avant : [...avant, vue]))
          }
          if (
            message.type === 'restitution.demande' &&
            message.relance === '' &&
            message.serie === 'restitution'
          ) {
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
                  const recue = CorrectionRendue.parse(reponse)
                  // La fiche ne reçoit que les champs du pont : son pont embarqué refuse le reste.
                  vers({ type: 'restitution.correction', ...pourLaPage(recue) })
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
                      .map((erreur) => ({
                        erreur,
                        correction: recue.id,
                        question: recue.question,
                        reponse: reponseDonnee,
                      })),
                  ])
                  rappelSeries.current?.()
                  return
                }
                const recalcule = statutDeReponse(envoi.route, reponse)
                if (recalcule !== null) appliquerStatut(recalcule)
                if (message.type === 'bilan.erreurs') rappelSeries.current?.()
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
      const fenetre = iframe.current?.contentWindow ?? null
      const resultat = filtrerMessage(evenement, { fenetreFiche: fenetre, bloc, version })
      if (resultat.accepte) {
        fenetreFiche.current = fenetre
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
    const generation = (generationEcouteur.current += 1)
    return () => {
      window.removeEventListener('message', surMessage)
      /*
       * La fiche qui s'en va (on quitte le bloc) envoie son dernier état à son déchargement, après le
       * retrait de l'écouteur. On l'écoute encore un moment, de cette fenêtre-là seulement et pour ce
       * seul message : sinon la dernière réponse serait perdue. Un nouvel écouteur installé entre-temps
       * (la même page qui se met à jour) reprend tout.
       */
      const fenetre = fenetreFiche.current
      if (fenetre === null) return
      const dernierEtat = (evenement: MessageEvent) => {
        if (generationEcouteur.current !== generation) return
        const { bloc, version } = dernieres.current.donnees
        const resultat = filtrerMessage(evenement, { fenetreFiche: fenetre, bloc, version })
        if (resultat.accepte && resultat.message.type === 'etat.sauver') traiter(resultat.message)
      }
      // La fenêtre est gardée : le minuteur peut survivre à la page (les tests démontent `window`).
      const hote = window
      hote.addEventListener('message', dernierEtat)
      setTimeout(() => {
        hote.removeEventListener('message', dernierEtat)
      }, DELAI_DERNIER_ETAT_MS)
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

  /**
   * Confirmer une erreur de l'IA l'ouvre ; la rejeter garde la décision dans l'historique, et la fiche
   * la retire de son bilan, qui sinon la cocherait d'office.
   */
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
          if (decision === 'rejetee') {
            vers({
              type: 'erreur.rejetee',
              question: proposition.question,
              erreur: proposition.erreur,
            })
          }
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

  /**
   * Recommencer la fiche : son état repart à vide (première étape, champs vides), et les étapes vues
   * ne sont plus cochées (le serveur garde le fait `fiche_recommencee`). Les preuves, les erreurs
   * critiques et le statut restent. L'écriture prend la place d'un état encore en attente (même
   * clé) ; `surFait` vient après la réponse, avec le statut recalculé.
   */
  const recommencer = (surFait: () => void, surRefus: () => void) => {
    const { donnees: courantes } = dernieres.current
    const id = nouvelId(Date.parse(instantReel()))
    dernieres.current.etat = {}
    sauvegardesIgnorees.current = true
    void boite.ajouter(
      {
        id,
        route: 'PUT /blocs/:id/etat-page',
        params: { id: courantes.bloc },
        corps: { version: courantes.etatPage?.version ?? 0, etat: {}, recommencer: true },
        cle: `etat:${courantes.bloc}`,
      },
      {
        surReponse: (reponse) => {
          const recalcule = statutDeReponse('PUT /blocs/:id/etat-page', reponse)
          if (recalcule !== null) appliquerStatut(recalcule)
          setEtapesVues([])
          surFait()
        },
        surRefus: () => {
          sauvegardesIgnorees.current = false
          surRefus()
        },
        surConflit: surRefus,
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
    recommencer,
    conflit,
    refus,
    /** `retourCours` : « Revoir le cours » pendant une série, la fiche rouvre le cours en un clic. */
    allerEtape: (etape: string, options: { readonly retourCours?: boolean } = {}) => {
      vers({
        type: 'etape.aller',
        etape,
        ...(options.retourCours === true ? { retour_cours: true as const } : {}),
      })
    },
    statut,
    /** La hauteur du contenu de la fiche, `null` tant qu'elle ne l'a pas donnée. */
    hauteur,
    etapeVue,
    etapesVues,
    bilanFait,
    envoyees,
    chargement,
    recharger: () => {
      setChargement((valeur) => valeur + 1)
    },
  }
}
