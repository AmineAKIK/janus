import { useSyncExternalStore } from 'react'

const REQUETE = '(min-width: 1024px)'

const suivre = (rappel: () => void) => {
  if (typeof window.matchMedia !== 'function') return () => undefined
  const media = window.matchMedia(REQUETE)
  media.addEventListener('change', rappel)
  return () => {
    media.removeEventListener('change', rappel)
  }
}

const lire = () => typeof window.matchMedia === 'function' && window.matchMedia(REQUETE).matches

/** Vrai sur un écran de bureau : une page à sommaire ; sinon une liste puis une route par section. */
export function useBureau(): boolean {
  return useSyncExternalStore(suivre, lire, () => false)
}
