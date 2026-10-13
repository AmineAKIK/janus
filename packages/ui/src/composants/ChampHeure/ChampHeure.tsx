import { Clock } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ChampAvecLibelle, DeclencheurDialogue, SurfaceDialogue } from '../../utilitaires/champ.tsx'
import { classes } from '../../utilitaires/classes.ts'
import { useSurface } from '../../utilitaires/surface.tsx'
import styles from './ChampHeure.module.css'

export interface ProprietesChampHeure {
  readonly libelle: string
  readonly libelleMasque?: boolean
  /** `HH:MM`. */
  readonly valeur: string
  /** Appelé à la fermeture, avec `HH:MM`, seulement si l'heure a changé. */
  readonly onChange: (valeur: string) => void
  readonly textes?: { readonly heures: string; readonly minutes: string }
  readonly disabled?: boolean
  readonly id?: string
  readonly className?: string | undefined
}

const LARGEUR = 188
const HAUTEUR = 300
const HEURES = Array.from({ length: 24 }, (_, index) => index)
const MINUTES = Array.from({ length: 60 }, (_, index) => index)
const deux = (nombre: number) => String(nombre).padStart(2, '0')

function lire(valeur: string): { heure: number; minute: number } {
  const lu = /^(\d{2}):(\d{2})$/.exec(valeur)
  const heure = Number(lu?.[1])
  const minute = Number(lu?.[2])
  return lu !== null && heure < 24 && minute < 60 ? { heure, minute } : { heure: 0, minute: 0 }
}

type Colonne = 'heure' | 'minute'

/**
 * Choix d'une heure sur mesure (remplace `<input type="time">`) : deux colonnes, les heures et les
 * minutes. Le choix est rendu à la fermeture : un clic sur une minute, Entrée, ou un clic ailleurs.
 * Échap abandonne.
 */
export function ChampHeure({
  libelle,
  libelleMasque = false,
  valeur,
  onChange,
  textes = { heures: 'Heures', minutes: 'Minutes' },
  disabled = false,
  id,
  className,
}: ProprietesChampHeure) {
  const idAuto = useId()
  const idBouton = id ?? idAuto
  const idLibelle = `${idBouton}-libelle`
  const bouton = useRef<HTMLButtonElement>(null)
  const surface = useRef<HTMLDivElement>(null)
  const brouillonRef = useRef(lire(valeur))
  const [ouvert, setOuvert] = useState(false)
  const [brouillon, setBrouillon] = useState(lire(valeur))
  brouillonRef.current = brouillon

  const clore = useCallback(
    (valider: boolean, choix = brouillonRef.current) => {
      setOuvert(false)
      const { heure, minute } = choix
      const nouvelle = `${deux(heure)}:${deux(minute)}`
      if (valider && nouvelle !== valeur) onChange(nouvelle)
    },
    [valeur, onChange],
  )
  const fermerEnValidant = useCallback(() => {
    clore(true)
  }, [clore])
  const style = useSurface({
    ouverte: ouvert,
    ancre: bouton,
    surface,
    largeur: LARGEUR,
    hauteur: HAUTEUR,
    fermer: fermerEnValidant,
  })
  const placee = style !== null

  const focaliser = (colonne: Colonne) => {
    requestAnimationFrame(() => {
      const option = surface.current?.querySelector<HTMLElement>(
        `[data-colonne="${colonne}"] [aria-selected="true"]`,
      )
      option?.focus()
      if (typeof option?.scrollIntoView === 'function') option.scrollIntoView({ block: 'center' })
    })
  }

  useEffect(() => {
    if (ouvert && placee) focaliser('heure')
  }, [ouvert, placee])

  const ouvrir = () => {
    setBrouillon(lire(valeur))
    setOuvert(true)
  }

  const rendreLeFocus = (valider: boolean) => {
    clore(valider)
    bouton.current?.focus()
  }

  const choisir = (colonne: Colonne, nombre: number) => {
    setBrouillon((avant) => ({ ...avant, [colonne]: nombre }))
  }

  const surTouche = (evenement: KeyboardEvent<HTMLDivElement>, colonne: Colonne) => {
    const maximum = colonne === 'heure' ? 23 : 59
    const actuel = brouillon[colonne]
    const aller = (nombre: number) => {
      evenement.preventDefault()
      const borne = Math.max(0, Math.min(maximum, nombre))
      choisir(colonne, borne)
      focaliser(colonne)
    }
    switch (evenement.key) {
      case 'ArrowDown':
        aller(actuel + 1)
        return
      case 'ArrowUp':
        aller(actuel - 1)
        return
      case 'PageDown':
        aller(actuel + 10)
        return
      case 'PageUp':
        aller(actuel - 10)
        return
      case 'Home':
        aller(0)
        return
      case 'End':
        aller(maximum)
        return
      case 'ArrowRight':
      case 'ArrowLeft':
        evenement.preventDefault()
        focaliser(colonne === 'heure' ? 'minute' : 'heure')
        return
      case 'Enter':
        evenement.preventDefault()
        rendreLeFocus(true)
        return
      case 'Escape':
        evenement.preventDefault()
        evenement.stopPropagation()
        rendreLeFocus(false)
        return
    }
  }

  const colonne = (nom: Colonne, nombres: readonly number[], titre: string) => (
    <div
      role="listbox"
      aria-label={titre}
      data-colonne={nom}
      className={styles['colonne']}
      onKeyDown={(evenement) => {
        surTouche(evenement, nom)
      }}
    >
      {nombres.map((nombre) => {
        const choisie = brouillon[nom] === nombre
        return (
          <button
            key={nombre}
            type="button"
            role="option"
            aria-selected={choisie}
            tabIndex={choisie ? 0 : -1}
            className={classes(styles['nombre'], 'texte-corps-16')}
            onClick={() => {
              choisir(nom, nombre)
              if (nom === 'heure') focaliser('minute')
              else {
                clore(true, { ...brouillon, minute: nombre })
                bouton.current?.focus()
              }
            }}
          >
            {deux(nombre)}
          </button>
        )
      })}
    </div>
  )

  return (
    <ChampAvecLibelle
      libelle={libelle}
      libelleMasque={libelleMasque}
      idLibelle={idLibelle}
      disabled={disabled}
      className={className}
    >
      <DeclencheurDialogue
        ref={bouton}
        id={idBouton}
        idLibelle={idLibelle}
        ouvert={ouvert}
        disabled={disabled}
        onClick={() => {
          if (ouvert) clore(true)
          else ouvrir()
        }}
        icone={Clock}
        texte={valeur}
      />
      {ouvert && style !== null && (
        <SurfaceDialogue
          surface={surface}
          ancre={bouton}
          libelle={libelle}
          className={styles['surface']}
          style={style}
          fermer={fermerEnValidant}
        >
          {colonne('heure', HEURES, textes.heures)}
          {colonne('minute', MINUTES, textes.minutes)}
        </SurfaceDialogue>
      )}
    </ChampAvecLibelle>
  )
}
