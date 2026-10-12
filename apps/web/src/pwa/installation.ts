/** Ce que l'appli sait de son installation : déjà installée, installable d'un geste, à installer à la main (iOS) ou rien à proposer. */
export type EtatInstallation = 'installee' | 'installable' | 'manuelle' | 'indisponible'

/** L'événement `beforeinstallprompt` de Chrome et d'Edge, qui n'est pas dans les types du DOM. */
interface InvitationInstallation extends Event {
  readonly prompt: () => Promise<void>
  readonly userChoice: Promise<{ readonly outcome: 'accepted' | 'dismissed' }>
}

const estInvitation = (evenement: Event): evenement is InvitationInstallation =>
  'prompt' in evenement && typeof evenement.prompt === 'function'

/** Les modes d'affichage d'une appli installée : fenêtre autonome, sans barre d'adresse. */
const MODES_INSTALLEE = ['standalone', 'window-controls-overlay', 'minimal-ui', 'fullscreen']

/** Safari sur iPhone et iPad ne propose aucune invitation : l'installation passe par « Sur l'écran d'accueil ». */
function estAppleSansInvitation(fenetre: Window): boolean {
  const { userAgent, maxTouchPoints } = fenetre.navigator
  const iphone = /iPhone|iPad|iPod/.test(userAgent)
  const ipadBureau = /Macintosh/.test(userAgent) && maxTouchPoints > 1
  return iphone || ipadBureau
}

function estInstallee(fenetre: Window): boolean {
  if ('standalone' in fenetre.navigator && fenetre.navigator.standalone === true) return true
  return MODES_INSTALLEE.some((mode) => fenetre.matchMedia(`(display-mode: ${mode})`).matches)
}

/**
 * L'installation de l'appli. À démarrer dès le lancement : Chrome n'envoie son invitation qu'une
 * fois, souvent bien avant que l'écran des paramètres existe, et il faut la garder.
 */
export function creerInstallation(fenetre: Window) {
  let invitation: InvitationInstallation | null = null
  let installee = estInstallee(fenetre)
  const abonnes = new Set<() => void>()
  const signaler = () => {
    abonnes.forEach((abonne) => {
      abonne()
    })
  }
  const etat = (): EtatInstallation => {
    if (installee) return 'installee'
    if (invitation !== null) return 'installable'
    return estAppleSansInvitation(fenetre) ? 'manuelle' : 'indisponible'
  }
  // L'état est un texte simple : `useSyncExternalStore` n'a pas à comparer d'objet.
  return {
    demarrer: (): (() => void) => {
      const surInvitation = (evenement: Event) => {
        if (!estInvitation(evenement)) return
        // Pas de bandeau du navigateur : l'appli propose elle-même l'installation, dans les paramètres.
        evenement.preventDefault()
        invitation = evenement
        signaler()
      }
      const surInstallation = () => {
        installee = true
        invitation = null
        signaler()
      }
      fenetre.addEventListener('beforeinstallprompt', surInvitation)
      fenetre.addEventListener('appinstalled', surInstallation)
      return () => {
        fenetre.removeEventListener('beforeinstallprompt', surInvitation)
        fenetre.removeEventListener('appinstalled', surInstallation)
      }
    },
    etat,
    /** Ouvre la boîte d'installation du navigateur ; vrai si l'utilisateur accepte. */
    installer: async (): Promise<boolean> => {
      const courante = invitation
      if (courante === null) return false
      // Une invitation ne sert qu'une fois, qu'elle soit acceptée ou non.
      invitation = null
      signaler()
      await courante.prompt()
      const { outcome } = await courante.userChoice
      return outcome === 'accepted'
    },
    abonner: (abonne: () => void): (() => void) => {
      abonnes.add(abonne)
      return () => {
        abonnes.delete(abonne)
      }
    },
  }
}

export type Installation = ReturnType<typeof creerInstallation>
