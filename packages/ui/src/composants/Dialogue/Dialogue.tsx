import { X } from 'lucide-react'
import type { KeyboardEvent, ReactNode } from 'react'
import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { classes } from '../../utilitaires/classes.ts'
import styles from './Dialogue.module.css'

export interface ProprietesDialogue {
  readonly titre: string
  readonly libelleFermer?: string
  /** Appelé par la croix et par Échap. */
  readonly surFermeture: () => void
  readonly children: ReactNode
  readonly className?: string
}

const FOCALISABLES =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Fenêtre modale : le fond est voilé, le focus reste dedans (Tab boucle), Échap la ferme et le focus
 * revient à l'élément qui l'a ouverte. Le premier élément marqué `data-focus-initial`, sinon le premier champ de saisie, prend le focus, sinon le premier
 * élément focalisable.
 */
export function Dialogue({
  titre,
  libelleFermer = 'Fermer',
  surFermeture,
  children,
  className,
}: ProprietesDialogue) {
  const idTitre = useId()
  const boite = useRef<HTMLDivElement>(null)
  const fermer = useRef(surFermeture)
  fermer.current = surFermeture

  useEffect(() => {
    const precedent = document.activeElement
    const boiteActuelle = boite.current
    const champ = boiteActuelle?.querySelector<HTMLElement>(
      '[data-focus-initial], input, textarea, select',
    )
    const premier = boiteActuelle?.querySelector<HTMLElement>(FOCALISABLES)
    ;(champ ?? premier)?.focus()
    return () => {
      if (precedent instanceof HTMLElement) precedent.focus()
    }
  }, [])

  const surTouche = (evenement: KeyboardEvent<HTMLDivElement>) => {
    if (evenement.key === 'Escape') {
      evenement.stopPropagation()
      fermer.current()
      return
    }
    if (evenement.key !== 'Tab') return
    const elements = [...(boite.current?.querySelectorAll<HTMLElement>(FOCALISABLES) ?? [])]
    const premier = elements[0]
    const dernier = elements.at(-1)
    if (premier === undefined || dernier === undefined) return
    const actif = document.activeElement
    if (evenement.shiftKey && (actif === premier || !boite.current?.contains(actif))) {
      evenement.preventDefault()
      dernier.focus()
    } else if (!evenement.shiftKey && (actif === dernier || !boite.current?.contains(actif))) {
      evenement.preventDefault()
      premier.focus()
    }
  }

  return createPortal(
    <div className={styles['voile']}>
      <div
        ref={boite}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitre}
        className={classes(styles['dialogue'], className)}
        onKeyDown={surTouche}
      >
        <div className={styles['entete']}>
          <h2 id={idTitre} className={`${styles['titre'] ?? ''} texte-titre-22`}>
            {titre}
          </h2>
          <button
            type="button"
            className={styles['fermer']}
            aria-label={libelleFermer}
            onClick={surFermeture}
          >
            <X aria-hidden="true" className={styles['croix']} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
