import styles from './PageSimple.module.css'

/** Page vide d'un écran pas encore codé : elle affiche seulement son titre. */
export function PageSimple({ titre }: { readonly titre: string }) {
  return (
    <h1 tabIndex={-1} className={`${styles['titre'] ?? ''} texte-titre-28`}>
      {titre}
    </h1>
  )
}
