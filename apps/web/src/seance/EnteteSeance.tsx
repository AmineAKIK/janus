import type { ReactNode } from 'react'
import styles from './Seance.module.css'
import { TEXTES_SEANCE as T } from './textes.ts'

/**
 * L'en-tête d'une séance : « Quitter » à gauche, le titre, puis ce que l'écran y ajoute (rang,
 * progression, parties). L'écran donne sa classe `colonnes` pour la grille.
 */
export function EnteteSeance({
  titre,
  libelleTitre,
  centre = false,
  colonnes,
  surQuitter,
  children,
}: {
  readonly titre: string
  /** Le nom accessible du titre quand il diffère du texte affiché. */
  readonly libelleTitre?: string
  readonly centre?: boolean
  readonly colonnes: string | undefined
  readonly surQuitter: () => void
  readonly children?: ReactNode
}) {
  return (
    <header className={`${styles['entete'] ?? ''} ${colonnes ?? ''}`}>
      <button
        type="button"
        className={`${styles['quitter'] ?? ''} texte-petit-14`}
        onClick={surQuitter}
      >
        <span aria-hidden="true">×</span> {T.quitter}
      </button>
      <h1
        tabIndex={-1}
        {...(libelleTitre === undefined ? {} : { 'aria-label': libelleTitre })}
        className={`${styles['titre'] ?? ''} ${centre ? (styles['centre'] ?? '') : ''} texte-sous-titre-18`}
      >
        {titre}
      </h1>
      {children}
    </header>
  )
}
