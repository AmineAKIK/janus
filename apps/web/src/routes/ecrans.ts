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
  }
}

export const TITRE_INTROUVABLE = 'Cette page n’existe pas'

/** `<Titre de l'écran> · <NOM_APPLI>` */
export function titreDocument(titre: string): string {
  return `${titre} · ${NOM_APPLI}`
}
