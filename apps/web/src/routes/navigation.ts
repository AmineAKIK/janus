import { modeHistorique } from './historique.ts'

const MODE = modeHistorique(import.meta.env.VITE_HISTORIQUE)

/** Adresse d'un lien interne : `#/chemin` (GitHub Pages) ou `/chemin` (VPS). */
export function adresse(lien: string): string {
  return MODE === 'chemins' ? lien : `#${lien}`
}

/** Va sur un chemin du routeur, dans l'un ou l'autre mode d'adresses. */
export function aller(lien: string): void {
  if (MODE === 'ancre') {
    window.location.hash = lien
    return
  }
  window.history.pushState(null, '', lien)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

/** En vraies adresses, un clic sur un lien interne reste dans l'appli au lieu de recharger la page. */
export function garderLesLiensDansLAppli(cible: Document): void {
  if (MODE === 'ancre') return
  cible.addEventListener('click', (evenement) => {
    if (evenement.defaultPrevented || evenement.button !== 0) return
    if (evenement.metaKey || evenement.ctrlKey || evenement.shiftKey || evenement.altKey) return
    const lien = (evenement.target as Element | null)?.closest('a')
    if (lien === null || lien === undefined) return
    if (lien.target !== '' || lien.hasAttribute('download')) return
    const url = new URL(lien.href, window.location.href)
    if (url.origin !== window.location.origin) return
    const chemin = `${url.pathname}${url.search}`
    if (url.hash !== '' && chemin === `${window.location.pathname}${window.location.search}`) return
    evenement.preventDefault()
    aller(`${chemin}${url.hash}`)
  })
}
