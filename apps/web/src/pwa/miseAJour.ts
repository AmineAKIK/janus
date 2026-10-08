/** Un aperçu de PR ne doit jamais enregistrer de service worker : il prendrait le contrôle du site principal. */
export const estApercu = (base: string) => base.includes('/pr-preview/')

/**
 * Seule la page de l'appli enregistre un service worker : jamais une page encadrée (une fiche, un
 * aperçu dans une iframe) ni un contexte où le navigateur refuse d'y toucher.
 */
function serviceWorkerDisponible(): boolean {
  try {
    return (
      window.top === window &&
      'serviceWorker' in navigator &&
      navigator.serviceWorker instanceof EventTarget
    )
  } catch {
    return false
  }
}

/** Ce que `virtual:pwa-register` rend : appliquer la version en attente (et recharger). */
export type Appliquer = (recharger?: boolean) => Promise<void>

/** Le `registerSW` de `vite-plugin-pwa`, réduit à ce que l'appli utilise. */
export type EnregistrerSw = (options: { readonly onNeedRefresh: () => void }) => Appliquer

/**
 * L'état de la mise à jour : une version attend ou non, et l'appli l'applique quand Amine le
 * demande. Sans enregistrement (aperçu de PR, navigateur sans service worker) rien n'attend jamais.
 */
export function creerMiseAJour(
  enregistrerSw: EnregistrerSw,
  base: string,
  disponible = serviceWorkerDisponible(),
) {
  let prete = false
  let appliquer: Appliquer | null = null
  const abonnes = new Set<() => void>()
  const signaler = () => {
    abonnes.forEach((abonne) => {
      abonne()
    })
  }
  return {
    /** À appeler une fois au démarrage. */
    demarrer(): void {
      if (estApercu(base) || !disponible) return
      appliquer = enregistrerSw({
        onNeedRefresh: () => {
          prete = true
          signaler()
        },
      })
    },
    versionPrete: () => prete,
    /** Active la version en attente (`SKIP_WAITING`) puis recharge la page. */
    appliquer: async (): Promise<void> => {
      await appliquer?.(true)
    },
    abonner: (abonne: () => void): (() => void) => {
      abonnes.add(abonne)
      return () => {
        abonnes.delete(abonne)
      }
    },
  }
}

export type MiseAJourAppli = ReturnType<typeof creerMiseAJour>
