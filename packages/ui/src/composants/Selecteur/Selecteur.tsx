import { Check, ChevronDown } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { classes } from '../../utilitaires/classes.ts'
import { useSurface } from '../../utilitaires/surface.tsx'
import styles from './Selecteur.module.css'

export interface OptionSelecteur {
  readonly valeur: string
  readonly libelle: string
}

export interface ProprietesSelecteur {
  /** Nom accessible, affiché au-dessus sauf si `libelleMasque`. */
  readonly libelle: string
  readonly libelleMasque?: boolean
  readonly options: readonly OptionSelecteur[]
  readonly valeur: string
  readonly onChange: (valeur: string) => void
  readonly disabled?: boolean
  readonly id?: string
  readonly className?: string | undefined
  /** Marque le contrôle qui prend le focus à l'ouverture d'une boîte de dialogue. */
  readonly 'data-focus-initial'?: boolean
}

const HAUTEUR_LISTE = 320
const DELAI_RECHERCHE_MS = 700

/**
 * Liste de choix sur mesure (remplace le `<select>` natif, dont la fenêtre ne se stylise pas) :
 * un bouton qui ouvre une liste dans le style de l'appli, au clavier comme à la souris. Le focus
 * reste sur le bouton ; la ligne active est annoncée par `aria-activedescendant`.
 */
export function Selecteur({
  libelle,
  libelleMasque = false,
  options,
  valeur,
  onChange,
  disabled = false,
  id,
  className,
  ...reste
}: ProprietesSelecteur) {
  const idAuto = useId()
  const idBouton = id ?? idAuto
  const idLibelle = `${idBouton}-libelle`
  const idListe = `${idBouton}-liste`
  const bouton = useRef<HTMLButtonElement>(null)
  const liste = useRef<HTMLUListElement>(null)
  const recherche = useRef({ texte: '', minuteur: 0 })
  const [ouvert, setOuvert] = useState(false)
  const [actif, setActif] = useState(0)

  const indexChoisi = Math.max(
    0,
    options.findIndex((option) => option.valeur === valeur),
  )
  const choisie = options[indexChoisi]

  const fermer = useCallback(() => {
    setOuvert(false)
  }, [])
  const style = useSurface({
    ouverte: ouvert,
    ancre: bouton,
    surface: liste,
    hauteur: HAUTEUR_LISTE,
    fermer,
  })

  const ouvrir = () => {
    setActif(indexChoisi)
    setOuvert(true)
  }

  // La ligne active reste visible quand la liste est longue.
  const placee = style !== null
  useEffect(() => {
    if (!ouvert || !placee) return
    const ligne = liste.current?.children[actif]
    if (ligne instanceof HTMLElement && typeof ligne.scrollIntoView === 'function') {
      ligne.scrollIntoView({ block: 'nearest' })
    }
  }, [ouvert, actif, placee])

  const choisir = (index: number) => {
    const option = options[index]
    if (option !== undefined && option.valeur !== valeur) onChange(option.valeur)
    setOuvert(false)
  }

  const aller = (index: number) => {
    setActif(Math.max(0, Math.min(options.length - 1, index)))
  }

  const surTouche = (evenement: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    const { key } = evenement
    if (!ouvert) {
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') {
        evenement.preventDefault()
        ouvrir()
      }
      return
    }
    switch (key) {
      case 'ArrowDown':
        evenement.preventDefault()
        aller(actif + 1)
        return
      case 'ArrowUp':
        evenement.preventDefault()
        aller(actif - 1)
        return
      case 'PageDown':
        evenement.preventDefault()
        aller(actif + 10)
        return
      case 'PageUp':
        evenement.preventDefault()
        aller(actif - 10)
        return
      case 'Home':
        evenement.preventDefault()
        aller(0)
        return
      case 'End':
        evenement.preventDefault()
        aller(options.length - 1)
        return
      case 'Enter':
      case ' ':
        evenement.preventDefault()
        choisir(actif)
        return
      case 'Escape':
        // Ferme la liste seulement : une boîte de dialogue autour reste ouverte.
        evenement.preventDefault()
        evenement.stopPropagation()
        setOuvert(false)
        return
      case 'Tab':
        setOuvert(false)
        return
    }
    if (key.length === 1 && !evenement.ctrlKey && !evenement.metaKey && !evenement.altKey) {
      window.clearTimeout(recherche.current.minuteur)
      recherche.current.texte += key.toLowerCase()
      recherche.current.minuteur = window.setTimeout(() => {
        recherche.current.texte = ''
      }, DELAI_RECHERCHE_MS)
      const depuis = recherche.current.texte.length === 1 ? actif + 1 : actif
      const ordre = [...options.keys()]
      const trouve = [...ordre.slice(depuis), ...ordre.slice(0, depuis)].find((index) =>
        options[index]?.libelle.toLowerCase().startsWith(recherche.current.texte),
      )
      if (trouve !== undefined) aller(trouve)
    }
  }

  return (
    <div className={classes(styles['champ'], disabled && styles['desactive'], className)}>
      <span
        id={idLibelle}
        className={classes(styles['libelle'], libelleMasque && styles['masque'], 'texte-petit-14')}
      >
        {libelle}
      </span>
      <button
        {...reste}
        ref={bouton}
        id={idBouton}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-controls={ouvert ? idListe : undefined}
        aria-labelledby={idLibelle}
        aria-activedescendant={ouvert ? `${idBouton}-option-${String(actif)}` : undefined}
        disabled={disabled}
        className={classes(styles['bouton'], 'texte-corps-16')}
        onClick={() => {
          if (ouvert) setOuvert(false)
          else ouvrir()
        }}
        onKeyDown={surTouche}
        onBlur={() => {
          setOuvert(false)
        }}
      >
        <span className={styles['valeur']}>{choisie?.libelle ?? ''}</span>
        <ChevronDown
          aria-hidden="true"
          className={classes(styles['fleche'], ouvert && styles['ouvert'])}
        />
      </button>
      {ouvert &&
        style !== null &&
        createPortal(
          <ul
            ref={liste}
            id={idListe}
            role="listbox"
            aria-labelledby={idLibelle}
            className={styles['liste']}
            style={style}
            onMouseDown={(evenement) => {
              // Le focus reste sur le bouton : sinon la liste se fermerait avant le clic.
              evenement.preventDefault()
            }}
          >
            {options.map((option, index) => (
              <li
                key={option.valeur}
                id={`${idBouton}-option-${String(index)}`}
                role="option"
                aria-selected={option.valeur === valeur}
                data-actif={index === actif ? '' : undefined}
                className={classes(styles['option'], 'texte-corps-16')}
                onPointerMove={() => {
                  if (index !== actif) setActif(index)
                }}
                onClick={() => {
                  choisir(index)
                }}
              >
                <span className={styles['texteOption']}>{option.libelle}</span>
                {option.valeur === valeur && (
                  <Check aria-hidden="true" className={styles['coche']} />
                )}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  )
}
