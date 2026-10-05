export const THEMES = ['clair', 'sombre', 'systeme'] as const
export const TAILLES = ['petit', 'standard', 'grand'] as const

export type Theme = (typeof THEMES)[number]
export type Taille = (typeof TAILLES)[number]

export const CLE_THEME = 'janus.affichage.theme'
export const CLE_TAILLE = 'janus.affichage.taille'

export const THEME_PAR_DEFAUT: Theme = 'systeme'
export const TAILLE_PAR_DEFAUT: Taille = 'standard'

function estTheme(valeur: unknown): valeur is Theme {
  return THEMES.some((theme) => theme === valeur)
}

function estTaille(valeur: unknown): valeur is Taille {
  return TAILLES.some((taille) => taille === valeur)
}

function lire(cle: string): string | null {
  try {
    return localStorage.getItem(cle)
  } catch {
    return null
  }
}

function ecrire(cle: string, valeur: string): void {
  try {
    localStorage.setItem(cle, valeur)
  } catch {
    // Stockage indisponible (navigation privée, quota) : le choix vaut pour cette page seulement.
  }
}

export function lireTheme(): Theme {
  const valeur = lire(CLE_THEME)
  return estTheme(valeur) ? valeur : THEME_PAR_DEFAUT
}

export function lireTaille(): Taille {
  const valeur = lire(CLE_TAILLE)
  return estTaille(valeur) ? valeur : TAILLE_PAR_DEFAUT
}

export function appliquerTheme(theme: Theme): void {
  document.documentElement.dataset['theme'] = theme
  ecrire(CLE_THEME, theme)
}

export function appliquerTaille(taille: Taille): void {
  document.documentElement.dataset['taille'] = taille
  ecrire(CLE_TAILLE, taille)
}
