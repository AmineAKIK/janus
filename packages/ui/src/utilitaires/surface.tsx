import type { CSSProperties, RefObject } from 'react'
import { useEffect, useLayoutEffect, useState } from 'react'

const MARGE = 8
const ECART = 6

export interface OptionsSurface {
  /** Vrai tant que la surface est ouverte. */
  readonly ouverte: boolean
  /** L'élément sous lequel la surface s'ouvre. */
  readonly ancre: RefObject<HTMLElement | null>
  /** La surface elle-même (avec ce qu'elle contient), pour savoir si un clic est dehors. */
  readonly surface: RefObject<HTMLElement | null>
  /** Largeur fixe en px ; sinon celle de l'ancre. */
  readonly largeur?: number
  /** Hauteur souhaitée en px : décide si la surface s'ouvre dessous ou dessus. */
  readonly hauteur: number
  readonly fermer: () => void
}

/**
 * Place une surface flottante (liste, calendrier) sous son ancre, ou au-dessus quand il manque de la
 * place, sans jamais sortir de l'écran. Elle suit l'ancre quand la page défile ou change de taille ;
 * un clic ailleurs la ferme. Rend le style à poser sur la surface, ou `null` avant le premier calcul.
 */
export function useSurface({
  ouverte,
  ancre,
  surface,
  largeur,
  hauteur,
  fermer,
}: OptionsSurface): CSSProperties | null {
  const [style, setStyle] = useState<CSSProperties | null>(null)

  useLayoutEffect(() => {
    if (!ouverte) {
      setStyle(null)
      return
    }
    const placer = () => {
      const element = ancre.current
      if (element === null) return
      const boite = element.getBoundingClientRect()
      const voulue = largeur ?? boite.width
      // Alignée sur le bord gauche de l'ancre ; si elle déborde de l'écran, sur son bord droit.
      const alignee =
        boite.left + voulue > window.innerWidth - MARGE ? boite.right - voulue : boite.left
      const gauche = Math.max(MARGE, Math.min(alignee, window.innerWidth - voulue - MARGE))
      const dessous = window.innerHeight - boite.bottom - MARGE - ECART
      const dessus = boite.top - MARGE - ECART
      // Dessous si elle y tient en entier ; sinon là où il y a le plus de place.
      const enHaut = dessous < hauteur && dessus > dessous
      const place = Math.max(120, enHaut ? dessus : dessous)
      setStyle({
        position: 'fixed',
        left: gauche,
        width: voulue,
        maxHeight: Math.min(hauteur, place),
        ...(enHaut
          ? { bottom: window.innerHeight - boite.top + ECART }
          : { top: boite.bottom + ECART }),
      })
    }
    placer()
    window.addEventListener('resize', placer)
    window.addEventListener('scroll', placer, true)
    return () => {
      window.removeEventListener('resize', placer)
      window.removeEventListener('scroll', placer, true)
    }
  }, [ouverte, ancre, largeur, hauteur])

  useEffect(() => {
    if (!ouverte) return
    const surClic = (evenement: PointerEvent) => {
      const cible = evenement.target
      if (!(cible instanceof Node)) return
      if (surface.current?.contains(cible) === true || ancre.current?.contains(cible) === true) {
        return
      }
      fermer()
    }
    document.addEventListener('pointerdown', surClic)
    return () => {
      document.removeEventListener('pointerdown', surClic)
    }
  }, [ouverte, ancre, surface, fermer])

  return style
}
