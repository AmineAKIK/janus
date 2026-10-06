import type { Ref } from 'react'
import styles from './Bloc.module.css'

/**
 * L'iframe d'une fiche. Le bac à sable ne contient que `allow-scripts` : jamais `allow-same-origin`,
 * `allow-forms`, `allow-popups` ni `allow-top-navigation`.
 */
export function IframeFiche({
  code,
  titre,
  src,
  reference,
}: {
  readonly code: string
  readonly titre: string
  readonly src: string
  readonly reference: Ref<HTMLIFrameElement>
}) {
  return (
    <iframe
      ref={reference}
      src={src}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      title={`Fiche du bloc ${code} : ${titre}`}
      className={styles['iframe']}
    />
  )
}
