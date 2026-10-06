import { ErreurApi, ErreurDonnees, ErreurReseau } from '@janus/contrats'
import type { Transport } from '@janus/contrats'
import type { EnvoiDeMessage } from './messages.ts'
import { appelerEntree } from './routes.ts'
import type { EntreeEnvoi, StockageEnvoi } from './stockageEnvoi.ts'

/** Les attentes avant un nouvel essai, en secondes ; la dernière se répète. */
export const DELAIS_REESSAI_S = [2, 4, 8, 16, 32, 60] as const
/** Le délai de l'envoi périodique tant qu'il reste des messages. */
export const PERIODE_ENVOI_MS = 30_000

/** Exécute le travail en exclusivité : un seul expéditeur à la fois, même entre onglets. */
export type Verrou = <T>(travail: () => Promise<T>) => Promise<T>

/** Le verrou Web Locks `janus-envoi` ; sans Web Locks, un verrou propre à l'onglet. */
export function creerVerrouNavigateur(
  gestionnaire: LockManager | undefined = globalThis.navigator.locks,
): Verrou {
  if (typeof gestionnaire === 'undefined') return creerVerrouLocal()
  return (travail) => gestionnaire.request('janus-envoi', travail)
}

export function creerVerrouLocal(): Verrou {
  let suite: Promise<unknown> = Promise.resolve()
  return (travail) => {
    const resultat = suite.then(travail)
    suite = resultat.catch(() => undefined)
    return resultat
  }
}

export interface OptionsBoiteEnvoi {
  readonly stockage: StockageEnvoi
  readonly transport: Transport
  readonly verrou: Verrou
  /** L'instant présent, en ISO (la seule source de temps de l'appli est l'horloge). */
  readonly maintenant: () => string
  /** Vrai quand IndexedDB manque : les messages partent alors sans être gardés. */
  readonly indisponible?: () => boolean
  /** Pour les tests : remplace `setTimeout`. */
  readonly planifier?: (action: () => void, delaiMs: number) => () => void
}

/** Ce que l'appelant veut savoir de l'envoi d'un message, tant que l'onglet reste ouvert. */
export interface RappelsEnvoi {
  readonly surReponse?: (reponse: unknown) => void
  readonly surRefus?: () => void
  readonly surConflit?: () => void
}

export interface EcouteursBoite {
  /** Une entrée a été acceptée par le serveur, avec sa réponse. */
  readonly surReponse?: (entree: EntreeEnvoi, reponse: unknown) => void
  /** Le serveur a refusé l'entrée (400, 422) ou elle est abîmée : elle est supprimée. */
  readonly surRefus?: (entree: EntreeEnvoi) => void
  /** Un `409` sur l'état d'une page : l'appli n'écrase rien. */
  readonly surConflit?: (entree: EntreeEnvoi) => void
  /** Le contenu de la boîte a changé. */
  readonly surChangement?: () => void
}

function planifierParDefaut(action: () => void, delaiMs: number): () => void {
  const minuteur = setTimeout(action, delaiMs)
  return () => {
    clearTimeout(minuteur)
  }
}

/**
 * La boîte d'envoi : tout message est écrit avant d'être envoyé, puis envoyé dans l'ordre par un
 * seul expéditeur. Un échec réseau ou 5xx garde l'entrée et réessaie (2, 4, 8, 16, 32 puis 60 s) ;
 * un 2xx la supprime ; un 400 ou 422 la supprime en le signalant ; un 401 suspend l'envoi.
 */
export function creerBoiteEnvoi(options: OptionsBoiteEnvoi, ecouteurs: EcouteursBoite = {}) {
  const { stockage, transport, verrou, maintenant, planifier = planifierParDefaut } = options
  const rappels = new Map<string, RappelsEnvoi>()
  const versions = new Map<string, number>()
  let prochainOrdre: number | null = null
  let suspendue = false
  let annulerReessai: (() => void) | null = null
  let reseauManque = false
  const abonnes = new Set<() => void>()
  const signaler = () => {
    ecouteurs.surChangement?.()
    abonnes.forEach((abonne) => {
      abonne()
    })
  }

  async function ordreSuivant(): Promise<number> {
    if (prochainOrdre === null) {
      const entrees = await stockage.lister()
      prochainOrdre = Math.max(0, ...entrees.map(({ ordre }) => ordre)) + 1
    }
    return prochainOrdre++
  }

  function prevoirReessai(essais: number) {
    annulerReessai?.()
    const delai = DELAIS_REESSAI_S[Math.min(essais, DELAIS_REESSAI_S.length) - 1] ?? 60
    annulerReessai = planifier(() => {
      annulerReessai = null
      void vider()
    }, delai * 1000)
  }

  /** L'état d'une page part avec la dernière version que ce navigateur a vue. */
  function avecVersion(entree: EntreeEnvoi): EntreeEnvoi {
    const bloc = entree.params?.['id']
    const version = bloc === undefined ? undefined : versions.get(bloc)
    if (entree.route !== 'PUT /blocs/:id/etat-page' || version === undefined) return entree
    if (typeof entree.corps !== 'object' || entree.corps === null) return entree
    return { ...entree, corps: { ...entree.corps, version } }
  }

  async function traiter(entree: EntreeEnvoi): Promise<'continuer' | 'arreter'> {
    try {
      const reponse = await appelerEntree(transport, avecVersion(entree))
      await stockage.supprimer(entree.id)
      reseauManque = false
      if (
        entree.route === 'PUT /blocs/:id/etat-page' &&
        typeof reponse === 'object' &&
        reponse !== null &&
        'version' in reponse &&
        typeof reponse.version === 'number'
      ) {
        const bloc = entree.params?.['id']
        if (bloc !== undefined) versions.set(bloc, reponse.version)
      }
      const rappel = rappels.get(entree.id)
      rappels.delete(entree.id)
      ecouteurs.surReponse?.(entree, reponse)
      rappel?.surReponse?.(reponse)
      return 'continuer'
    } catch (erreur) {
      if (erreur instanceof ErreurApi && erreur.status === 401) {
        suspendue = true
        return 'arreter'
      }
      if (erreur instanceof ErreurApi && erreur.status === 409 && entree.cle !== undefined) {
        await stockage.supprimer(entree.id)
        const rappel = rappels.get(entree.id)
        rappels.delete(entree.id)
        ecouteurs.surConflit?.(entree)
        rappel?.surConflit?.()
        return 'continuer'
      }
      const refuse =
        erreur instanceof ErreurDonnees ||
        (erreur instanceof ErreurApi &&
          (erreur.status === 400 || erreur.status === 422 || erreur.status === 409))
      if (refuse) {
        console.error(`[janus] message refusé par le serveur (${entree.route})`, erreur)
        await stockage.supprimer(entree.id)
        const rappel = rappels.get(entree.id)
        rappels.delete(entree.id)
        ecouteurs.surRefus?.(entree)
        rappel?.surRefus?.()
        return 'continuer'
      }
      if (erreur instanceof ErreurReseau) reseauManque = true
      await stockage.compterEssai(entree.id)
      prevoirReessai(entree.essais + 1)
      return 'arreter'
    }
  }

  /** Envoie tout ce qui est gardé, dans l'ordre, jusqu'au premier échec à réessayer. */
  async function vider(): Promise<void> {
    if (suspendue) return
    await verrou(async () => {
      for (const entree of await stockage.lister()) {
        if (suspendue) break
        const suite = await traiter(entree)
        signaler()
        if (suite === 'arreter') break
      }
    })
  }

  return {
    /** Écrit le message dans la boîte, puis tente de l'envoyer. */
    async ajouter(
      envoi: EnvoiDeMessage & { readonly id: string },
      rappelsDuMessage?: RappelsEnvoi,
    ): Promise<void> {
      const entree: EntreeEnvoi = {
        id: envoi.id,
        route: envoi.route,
        ...(envoi.params === undefined ? {} : { params: envoi.params }),
        corps: envoi.corps,
        ...(envoi.cle === undefined ? {} : { cle: envoi.cle }),
        cree_le: maintenant(),
        ordre: await ordreSuivant(),
        essais: 0,
      }
      await stockage.ajouter(entree)
      if (rappelsDuMessage !== undefined) rappels.set(entree.id, rappelsDuMessage)
      signaler()
      await vider()
    },
    vider,
    /** Après la reconnexion : l'envoi suspendu par un 401 reprend. */
    reprendre(): Promise<void> {
      suspendue = false
      return vider()
    },
    entrees: () => stockage.lister(),
    /** Vrai tant que le dernier envoi a échoué faute de réseau. */
    reseauManque: () => reseauManque,
    stockageIndisponible: () => options.indisponible?.() ?? false,
    /** Appelé à chaque changement de la boîte ; rend la fonction qui arrête d'écouter. */
    abonner(abonne: () => void): () => void {
      abonnes.add(abonne)
      return () => {
        abonnes.delete(abonne)
      }
    },
    /** Le réseau est revenu ou parti d'après le navigateur : l'indicateur suit. */
    signalerReseau(manque: boolean): void {
      reseauManque = manque
      signaler()
    },
    /** La version de l'état d'une page que ce navigateur a lue : la suivante part avec elle. */
    fixerVersion(bloc: string, version: number): void {
      versions.set(bloc, version)
    },
    /** Les déclencheurs : retour du réseau, retour au premier plan, et toutes les 30 secondes. */
    demarrer(): () => void {
      const declencher = () => {
        void vider()
      }
      const auPremierPlan = () => {
        if (document.visibilityState === 'visible') declencher()
      }
      const enLigne = () => {
        reseauManque = false
        signaler()
        declencher()
      }
      const horsLigne = () => {
        reseauManque = true
        signaler()
      }
      window.addEventListener('online', enLigne)
      window.addEventListener('offline', horsLigne)
      document.addEventListener('visibilitychange', auPremierPlan)
      const periodique = setInterval(() => {
        void stockage.lister().then((restantes) => {
          if (restantes.length > 0) declencher()
        })
      }, PERIODE_ENVOI_MS)
      declencher()
      return () => {
        window.removeEventListener('online', enLigne)
        window.removeEventListener('offline', horsLigne)
        document.removeEventListener('visibilitychange', auPremierPlan)
        clearInterval(periodique)
        annulerReessai?.()
      }
    },
  }
}

export type BoiteEnvoi = ReturnType<typeof creerBoiteEnvoi>
