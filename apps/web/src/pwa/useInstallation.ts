import { createContext, use, useSyncExternalStore } from 'react'
import type { EtatInstallation, Installation } from './installation.ts'

/** Sans fournisseur (tests, pages hors appli) : rien à installer. */
const INSTALLATION_ABSENTE: Installation = {
  demarrer: () => () => undefined,
  etat: () => 'indisponible',
  installer: () => Promise.resolve(false),
  abonner: () => () => undefined,
}

export const ContexteInstallation = createContext<Installation>(INSTALLATION_ABSENTE)

/** L'état d'installation de l'appli et le geste pour la lancer. */
export function useInstallation(): { etat: EtatInstallation; installer: () => Promise<boolean> } {
  const installation = use(ContexteInstallation)
  const etat = useSyncExternalStore(installation.abonner, installation.etat)
  return { etat, installer: installation.installer }
}
