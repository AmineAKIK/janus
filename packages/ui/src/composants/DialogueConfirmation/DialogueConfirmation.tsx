import type { ReactNode } from 'react'
import { Bouton } from '../Bouton/Bouton.tsx'
import { Dialogue } from '../Dialogue/Dialogue.tsx'
import styles from './DialogueConfirmation.module.css'

export interface ProprietesDialogueConfirmation {
  readonly titre: string
  readonly libelleConfirmer: string
  readonly libelleAnnuler?: string
  readonly libelleFermer?: string
  /** Une action difficile à défaire : le bouton est rouge et le focus part sur « Annuler ». */
  readonly danger?: boolean
  /** Pendant l'action : le bouton de confirmation montre son chargement. */
  readonly enCours?: boolean
  readonly surConfirmer: () => void
  /** Appelé par « Annuler », la croix et Échap. */
  readonly surAnnuler: () => void
  /** Ce que l'action va faire, en une ou deux phrases. */
  readonly children: ReactNode
}

/**
 * Demande de confirmation avant une action : ce qui va se passer, puis « Annuler » à gauche et
 * l'action à droite. Elle ne se ferme pas toute seule : l'appelant décide quand, pour pouvoir
 * attendre la fin d'une action asynchrone.
 */
export function DialogueConfirmation({
  titre,
  libelleConfirmer,
  libelleAnnuler = 'Annuler',
  libelleFermer,
  danger = false,
  enCours = false,
  surConfirmer,
  surAnnuler,
  children,
}: ProprietesDialogueConfirmation) {
  return (
    <Dialogue
      titre={titre}
      surFermeture={surAnnuler}
      {...(libelleFermer === undefined ? {} : { libelleFermer })}
    >
      <div className={`${styles['message'] ?? ''} texte-corps-16`}>{children}</div>
      <div className={styles['actions']}>
        <Bouton
          type="button"
          variante="secondaire"
          {...(danger ? { 'data-focus-initial': true } : {})}
          onClick={surAnnuler}
        >
          {libelleAnnuler}
        </Bouton>
        <Bouton
          type="button"
          variante={danger ? 'danger' : 'principal'}
          chargement={enCours}
          {...(danger ? {} : { 'data-focus-initial': true })}
          onClick={surConfirmer}
        >
          {libelleConfirmer}
        </Bouton>
      </div>
    </Dialogue>
  )
}
