import { useSyncExternalStore } from 'react'

function abonner(abonne: () => void): () => void {
  window.addEventListener('online', abonne)
  window.addEventListener('offline', abonne)
  return () => {
    window.removeEventListener('online', abonne)
    window.removeEventListener('offline', abonne)
  }
}

/** Vrai tant que le navigateur se croit connecté ; suit les passages en ligne et hors ligne. */
export function useEnLigne(): boolean {
  return useSyncExternalStore(abonner, () => navigator.onLine)
}
