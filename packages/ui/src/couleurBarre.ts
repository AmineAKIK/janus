import type { Theme } from './theme.ts'

/** Le fond de chaque thème (`--couleur-fond` de `tokens.css`) : la couleur de la barre du navigateur ou de la fenêtre installée. */
export const COULEUR_BARRE = { clair: '#ffffff', sombre: '#14171a' } as const

/** La couleur annoncée par chaque balise `theme-color`, selon son attribut `media`. */
function couleurDeLaBalise(media: string | null, theme: Theme): string {
  if (theme === 'clair') return COULEUR_BARRE.clair
  if (theme === 'sombre') return COULEUR_BARRE.sombre
  return media?.includes('dark') === true ? COULEUR_BARRE.sombre : COULEUR_BARRE.clair
}

/**
 * Accorde les balises `theme-color` au thème choisi dans l'appli : avec « Système » chaque balise
 * garde sa couleur (clair ou sombre selon le système), avec un thème forcé les deux prennent la même.
 * Sans cela la barre du navigateur resterait sombre sur une page claire, et inversement.
 */
export function synchroniserCouleurBarre(theme: Theme): void {
  if (!('head' in document)) return
  document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((balise) => {
    balise.content = couleurDeLaBalise(balise.getAttribute('media'), theme)
  })
}
