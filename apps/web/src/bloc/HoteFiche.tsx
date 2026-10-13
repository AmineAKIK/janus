import type { Ref } from 'react'
import styles from './Bloc.module.css'

/**
 * L'iframe d'une fiche. Le bac à sable ne contient que `allow-scripts` : jamais `allow-same-origin`,
 * `allow-forms`, `allow-popups` ni `allow-top-navigation`. Quand la fiche a donné la hauteur de son
 * contenu, l'iframe la prend : la fiche ne défile plus seule, la page a un seul défilement.
 */
export function IframeFiche({
  code,
  titre,
  src,
  reference,
  hauteur,
  cachee,
}: {
  readonly code: string
  readonly titre: string
  readonly src: string
  readonly reference: Ref<HTMLIFrameElement>
  readonly hauteur: number | null
  /** Vrai tant que la fiche ne s'est pas présentée : seul le texte de chargement se voit. */
  readonly cachee: boolean
}) {
  return (
    <iframe
      ref={reference}
      src={src}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      title={`Fiche du bloc ${code} : ${titre}`}
      className={[
        styles['iframe'],
        hauteur === null ? styles['iframeSansHauteur'] : undefined,
        cachee ? styles['iframeCachee'] : undefined,
      ]
        .filter((classe) => classe !== undefined)
        .join(' ')}
      style={hauteur === null ? undefined : { blockSize: `${String(hauteur)}px` }}
    />
  )
}
