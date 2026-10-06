import { enIso, maintenantMs } from './horloge.ts'
import { nouvelId } from './identifiant.ts'
import { CorrectionRecue, MessageAppli, MessagePage } from './schemas.ts'

export { CorrectionRecue, MessageAppli, MessagePage }

/** Délai pour que l'appli réponde à `page.prete` ; passé ce délai, la fiche est seule. */
export const DELAI_POIGNEE_DE_MAIN_MS = 2000
/** Au plus un `etat.sauver` toutes les 2 secondes. */
export const INTERVALLE_SAUVER_MS = 2000

export type EtatPage = Extract<MessagePage, { type: 'etat.sauver' }>['etat']
type Init = Extract<MessageAppli, { type: 'etat.init' }>
type Statut = Extract<MessageAppli, { type: 'statut.maj' }>
type ErreurAppli = Extract<MessageAppli, { type: 'erreur' }>
type Demande = Extract<MessagePage, { type: 'restitution.demande' }>

/** Ce que la page donne pour demander une correction : le message sans ce que le pont ajoute. */
export type DemandeCorrection = Omit<Demande, 'id' | 'bloc' | 'version' | 't' | 'type'>
export type DonneesMessage<T extends MessagePage['type']> = Omit<
  Extract<MessagePage, { type: T }>,
  'id' | 'bloc' | 'version' | 't' | 'type'
>

/** Les fonctions que la fiche fournit pour fonctionner seule (sur claude.ai : Claude et `localStorage`). */
export interface Autonome {
  ask: (demande: DemandeCorrection) => Promise<CorrectionRecue>
  sauver: (etat: EtatPage) => void | Promise<void>
  /** L'état à reprendre au démarrage, `null` s'il n'y en a pas. */
  charger?: () => EtatPage | null
}

export interface OptionsDemarrage {
  /** Le bloc et la version du manifeste embarqué ; en mode appli, `etat.init` les remplace. */
  readonly manifeste: { readonly bloc: string; readonly version: number }
  readonly autonome?: Autonome
}

export interface Demarrage {
  readonly mode: 'appli' | 'autonome'
  /** L'état sauvegardé de la page, `null` s'il n'y en a pas. */
  readonly etat: EtatPage | null
  /** Le message `etat.init` en mode appli (statut, séries ouvertes), `null` en mode autonome. */
  readonly init: Init | null
}

/** Une erreur renvoyée par l'appli pour un message de la page. */
export class ErreurPont extends Error {
  readonly code: ErreurAppli['code']
  readonly detail: string

  constructor(erreur: Pick<ErreurAppli, 'code' | 'detail'>) {
    super(erreur.detail)
    this.name = 'ErreurPont'
    this.code = erreur.code
    this.detail = erreur.detail
  }
}

export interface OptionsPont {
  readonly fenetre?: Window
  /** Là où partent les messages ; la fenêtre parente par défaut. */
  readonly parent?: Pick<Window, 'postMessage'>
  readonly maintenant?: () => number
}

interface Attente {
  readonly id: string
  readonly question: string
  readonly resoudre: (correction: CorrectionRecue) => void
  readonly rejeter: (erreur: Error) => void
}

export interface Pont {
  demarrer: (options: OptionsDemarrage) => Promise<Demarrage>
  /** Envoie un message validé ; rend son identifiant, ou `null` s'il est mal formé (rien ne part). */
  envoyer: <T extends MessagePage['type']>(type: T, donnees: DonneesMessage<T>) => string | null
  /** Renvoie à l'identique (même identifiant) un message déjà envoyé. */
  renvoyer: (id: string) => boolean
  demanderCorrection: (demande: DemandeCorrection) => Promise<CorrectionRecue>
  sauver: (etat: EtatPage) => void
  surStatut: (rappel: (statut: Statut) => void) => () => void
  surErreur: (rappel: (erreur: ErreurAppli) => void) => () => void
  surEtape: (rappel: (etape: string) => void) => () => void
  /** Un `etat.init` reçu après le démarrage : les séries ouvertes ont changé (la consolidation s'ouvre). */
  surInit: (rappel: (init: Init) => void) => () => void
}

function abonnement<T>(rappels: Set<(valeur: T) => void>) {
  return (rappel: (valeur: T) => void) => {
    rappels.add(rappel)
    return () => {
      rappels.delete(rappel)
    }
  }
}

export function creerPont(options: OptionsPont = {}): Pont {
  const fenetre = options.fenetre ?? window
  const parent = options.parent ?? fenetre.parent
  const maintenant = options.maintenant ?? maintenantMs
  // Une fiche ouverte seule dans un navigateur est sa propre fenêtre parente : personne à qui parler.
  const seule = parent === fenetre

  let contexte: { bloc: string; version: number } | null = null
  let autonome: Autonome | undefined
  let mode: Demarrage['mode'] | null = null
  let attenteInit: ((init: Init) => void) | null = null
  const envoyes = new Map<string, MessagePage>()
  const attentes: Attente[] = []
  const rappelsStatut = new Set<(statut: Statut) => void>()
  const rappelsErreur = new Set<(erreur: ErreurAppli) => void>()
  const rappelsEtape = new Set<(etape: string) => void>()
  const rappelsInit = new Set<(init: Init) => void>()

  // --- Envoi -------------------------------------------------------------------------------------

  function construire(type: MessagePage['type'], donnees: object): unknown {
    return { id: nouvelId(maintenant()), ...contexte, t: enIso(maintenant()), type, ...donnees }
  }

  function refuser(raison: string, details: unknown): null {
    console.error(`[pont] Message non envoyé : ${raison}`, details)
    return null
  }

  function envoyer<T extends MessagePage['type']>(type: T, donnees: DonneesMessage<T>) {
    if (contexte === null) return refuser('demarrer() n’a pas été appelé.', type)
    const resultat = MessagePage.safeParse(construire(type, donnees))
    if (!resultat.success) return refuser(`« ${type} » est mal formé.`, resultat.error.issues)
    envoyes.set(resultat.data.id, resultat.data)
    if (!seule) parent.postMessage(resultat.data, '*')
    return resultat.data.id
  }

  function renvoyer(id: string) {
    const message = envoyes.get(id)
    if (message === undefined) return false
    if (!seule) parent.postMessage(message, '*')
    return true
  }

  // --- Réception ---------------------------------------------------------------------------------

  function retirerAttente(trouve: (attente: Attente) => boolean): Attente | undefined {
    const index = attentes.findIndex(trouve)
    return index === -1 ? undefined : attentes.splice(index, 1)[0]
  }

  function recevoir(message: MessageAppli) {
    switch (message.type) {
      case 'etat.init':
        if (attenteInit === null) {
          rappelsInit.forEach((rappel) => {
            rappel(message)
          })
        } else attenteInit(message)
        break
      case 'restitution.correction': {
        const correction = CorrectionRecue.parse(
          Object.fromEntries(Object.entries(message).filter(([cle]) => cle !== 'type')),
        )
        retirerAttente((attente) => attente.question === correction.question)?.resoudre(correction)
        break
      }
      case 'statut.maj':
        rappelsStatut.forEach((rappel) => {
          rappel(message)
        })
        break
      case 'erreur': {
        rappelsErreur.forEach((rappel) => {
          rappel(message)
        })
        const concernee = retirerAttente((attente) => attente.id === message.message_id)
        concernee?.rejeter(new ErreurPont(message))
        break
      }
      case 'etape.aller':
        rappelsEtape.forEach((rappel) => {
          rappel(message.etape)
        })
        break
    }
  }

  function ecouter(evenement: MessageEvent) {
    // Seule la fenêtre parente parle à la fiche.
    if (evenement.source !== parent) return
    const resultat = MessageAppli.safeParse(evenement.data)
    if (!resultat.success) {
      console.error('[pont] Message de l’appli ignoré : mal formé.', resultat.error.issues)
      return
    }
    recevoir(resultat.data)
  }

  // --- Sauvegarde --------------------------------------------------------------------------------

  let dernierEnvoye: string | null = null
  let enAttente: EtatPage | null = null
  let derniereEmission = Number.NEGATIVE_INFINITY
  let minuteur: ReturnType<typeof setTimeout> | undefined

  function emettre() {
    clearTimeout(minuteur)
    minuteur = undefined
    const etat = enAttente
    enAttente = null
    if (etat === null) return
    const json = JSON.stringify(etat)
    if (json === dernierEnvoye) return
    if (mode === 'autonome') {
      Promise.resolve(autonome?.sauver(etat)).catch((erreur: unknown) => {
        console.error('[pont] La sauvegarde autonome a échoué.', erreur)
      })
    } else if (envoyer('etat.sauver', { etat }) === null) {
      return
    }
    dernierEnvoye = json
    derniereEmission = maintenant()
  }

  function sauver(etat: EtatPage) {
    if (mode === null) {
      refuser('demarrer() n’a pas été appelé.', 'etat.sauver')
      return
    }
    enAttente = etat
    const attente = derniereEmission + INTERVALLE_SAUVER_MS - maintenant()
    if (attente <= 0) emettre()
    else minuteur ??= setTimeout(emettre, attente)
  }

  function ecouterDepart() {
    const document = fenetre.document
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') emettre()
    })
    fenetre.addEventListener('pagehide', emettre)
  }

  // --- Démarrage ---------------------------------------------------------------------------------

  async function demarrer(options: OptionsDemarrage): Promise<Demarrage> {
    contexte = { bloc: options.manifeste.bloc, version: options.manifeste.version }
    autonome = options.autonome
    fenetre.addEventListener('message', ecouter)
    ecouterDepart()

    const init = new Promise<Init | null>((resoudre) => {
      attenteInit = resoudre
      setTimeout(() => {
        resoudre(null)
      }, DELAI_POIGNEE_DE_MAIN_MS)
    })
    envoyer('page.prete', { schema: 2 })
    const recu = await init
    attenteInit = null

    if (recu === null) {
      mode = 'autonome'
      return { mode, etat: autonome?.charger?.() ?? null, init: null }
    }
    mode = 'appli'
    contexte = { bloc: recu.bloc, version: recu.version }
    return { mode, etat: recu.etat, init: recu }
  }

  // --- Corrections -------------------------------------------------------------------------------

  async function demanderCorrection(demande: DemandeCorrection): Promise<CorrectionRecue> {
    if (mode === 'autonome') {
      if (autonome === undefined) throw new Error('Mode autonome sans fonction « ask ».')
      const verdict = MessagePage.safeParse(construire('restitution.demande', demande))
      if (!verdict.success) {
        refuser('« restitution.demande » est mal formé.', verdict.error.issues)
        throw new Error('Demande de correction mal formée.')
      }
      return CorrectionRecue.parse(await autonome.ask(demande))
    }
    return new Promise<CorrectionRecue>((resoudre, rejeter) => {
      const id = envoyer('restitution.demande', demande)
      if (id === null) {
        rejeter(new Error('Demande de correction mal formée.'))
        return
      }
      attentes.push({ id, question: demande.question, resoudre, rejeter })
    })
  }

  return {
    demarrer,
    envoyer,
    renvoyer,
    demanderCorrection,
    sauver,
    surStatut: abonnement(rappelsStatut),
    surErreur: abonnement(rappelsErreur),
    surEtape: abonnement(rappelsEtape),
    surInit: abonnement(rappelsInit),
  }
}
