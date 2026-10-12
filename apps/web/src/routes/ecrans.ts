import type { CleNavigation } from '@janus/ui'
import { NOM_APPLI } from '@janus/ui'

/** Chaque route dit d'elle-même le titre de l'écran et la navigation que son cadre Figma montre. */
declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    readonly titre: string
    /** Entrée active de la navigation, ou `null` quand le cadre Figma n'en montre pas. */
    readonly navigation: CleNavigation | null
    /** Vrai pour un écran à deux colonnes (720 px et 320 px) : la colonne du cadre s'élargit. */
    readonly large?: boolean
    /** Vrai pour la seule page que les moteurs de recherche peuvent garder : les autres sont derrière un compte. */
    readonly indexable?: boolean
  }
}

/** Ce que la balise `robots` dit d'un écran : la vitrine s'indexe, tout le reste (compte, 404) non. */
export const ROBOTS_INDEXABLE = 'index, follow, max-image-preview:large'
export const ROBOTS_PRIVE = 'noindex, nofollow'

export const TITRE_INTROUVABLE = 'Cette page n’existe pas'

/** `<Titre de l'écran> · <NOM_APPLI>` */
export function titreDocument(titre: string): string {
  return `${titre} · ${NOM_APPLI}`
}
