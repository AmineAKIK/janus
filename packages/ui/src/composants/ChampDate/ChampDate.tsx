import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { classes } from '../../utilitaires/classes.ts'
import { useSurface } from '../../utilitaires/surface.tsx'
import {
  ajouterJours,
  ajouterMois,
  analyser,
  enTetesSemaine,
  formater,
  grilleDuMois,
  jourDeSemaine,
  libelleLong,
  libelleMois,
  memeJour,
} from './calendrier.ts'
import type { Jour } from './calendrier.ts'
import styles from './ChampDate.module.css'

export interface ProprietesChampDate {
  readonly libelle: string
  readonly libelleMasque?: boolean
  /** `AAAA-MM-JJ`, ou `''` quand aucune date n'est choisie. */
  readonly valeur: string
  /** Reçoit `AAAA-MM-JJ`, ou `''` quand la date est effacée. */
  readonly onChange: (valeur: string) => void
  /** Le jour d'aujourd'hui, `AAAA-MM-JJ` : le composant n'a pas d'horloge. */
  readonly aujourdhui: string
  /** Texte du bouton quand aucune date n'est choisie. */
  readonly texteVide?: string
  readonly textes?: {
    readonly precedent: string
    readonly suivant: string
    readonly effacer: string
    readonly aujourdhui: string
  }
  readonly disabled?: boolean
  readonly id?: string
  readonly className?: string | undefined
}

const TEXTES_FR = {
  precedent: 'Mois précédent',
  suivant: 'Mois suivant',
  effacer: 'Effacer',
  aujourdhui: 'Aujourd’hui',
}

const LARGEUR = 324
const HAUTEUR = 400
const SEMAINE = enTetesSemaine()

/**
 * Choix d'une date sur mesure (remplace `<input type="date">`, dont le calendrier ne se stylise pas) :
 * un bouton qui ouvre un calendrier dans le style de l'appli. Flèches pour les jours, Page
 * précédente et suivante pour les mois, Échap pour fermer.
 */
export function ChampDate({
  libelle,
  libelleMasque = false,
  valeur,
  onChange,
  aujourdhui,
  texteVide = 'Choisir une date',
  textes = TEXTES_FR,
  disabled = false,
  id,
  className,
}: ProprietesChampDate) {
  const idAuto = useId()
  const idBouton = id ?? idAuto
  const idLibelle = `${idBouton}-libelle`
  const bouton = useRef<HTMLButtonElement>(null)
  const surface = useRef<HTMLDivElement>(null)
  const [ouvert, setOuvert] = useState(false)
  const choisi = analyser(valeur)
  const jourAujourdhui = analyser(aujourdhui)
  const [courant, setCourant] = useState<Jour>(
    choisi ?? jourAujourdhui ?? { annee: 2026, mois: 1, jour: 1 },
  )

  const fermer = useCallback(() => {
    setOuvert(false)
  }, [])
  const style = useSurface({
    ouverte: ouvert,
    ancre: bouton,
    surface,
    largeur: LARGEUR,
    hauteur: HAUTEUR,
    fermer,
  })

  const ouvrir = () => {
    setCourant(choisi ?? jourAujourdhui ?? courant)
    setOuvert(true)
  }

  // À l'ouverture, le focus va sur le jour courant du calendrier.
  const placee = style !== null
  useEffect(() => {
    if (ouvert && placee) surface.current?.querySelector<HTMLElement>('[data-courant]')?.focus()
  }, [ouvert, placee])

  const rendreLeFocus = () => {
    setOuvert(false)
    bouton.current?.focus()
  }

  const choisir = (jour: Jour) => {
    onChange(formater(jour))
    rendreLeFocus()
  }

  const deplacer = (jour: Jour) => {
    setCourant(jour)
    // Le jour d'arrivée existe déjà dans la grille ou apparaît au rendu suivant.
    requestAnimationFrame(() => {
      surface.current?.querySelector<HTMLElement>('[data-courant]')?.focus()
    })
  }

  const surTouche = (evenement: KeyboardEvent<HTMLDivElement>) => {
    if (evenement.key === 'Escape') {
      evenement.preventDefault()
      evenement.stopPropagation()
      rendreLeFocus()
      return
    }
    if (
      !(evenement.target instanceof HTMLElement) ||
      evenement.target.dataset['jour'] === undefined
    ) {
      return
    }
    const decalage: Record<string, () => Jour | undefined> = {
      ArrowLeft: () => ajouterJours(courant, -1),
      ArrowRight: () => ajouterJours(courant, 1),
      ArrowUp: () => ajouterJours(courant, -7),
      ArrowDown: () => ajouterJours(courant, 7),
      Home: () => ajouterJours(courant, -jourDeSemaine(courant)),
      End: () => ajouterJours(courant, 6 - jourDeSemaine(courant)),
      PageUp: () => ajouterMois(courant, evenement.shiftKey ? -12 : -1),
      PageDown: () => ajouterMois(courant, evenement.shiftKey ? 12 : 1),
    }
    const suivant = decalage[evenement.key]?.()
    if (suivant !== undefined) {
      evenement.preventDefault()
      deplacer(suivant)
    }
  }

  const grille = grilleDuMois(courant.annee, courant.mois)

  return (
    <div className={classes(styles['champ'], disabled && styles['desactive'], className)}>
      <span
        id={idLibelle}
        className={classes(styles['libelle'], libelleMasque && styles['masque'], 'texte-petit-14')}
      >
        {libelle}
      </span>
      <button
        ref={bouton}
        id={idBouton}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        aria-labelledby={`${idLibelle} ${idBouton}-valeur`}
        disabled={disabled}
        className={classes(styles['bouton'], 'texte-corps-16')}
        onClick={() => {
          if (ouvert) setOuvert(false)
          else ouvrir()
        }}
      >
        <span
          id={`${idBouton}-valeur`}
          className={classes(styles['valeur'], choisi === null && styles['vide'])}
        >
          {choisi === null ? texteVide : libelleLong(choisi)}
        </span>
        <CalendarDays aria-hidden="true" className={styles['icone']} />
      </button>
      {ouvert &&
        style !== null &&
        createPortal(
          <div
            ref={surface}
            role="dialog"
            aria-label={libelle}
            className={styles['calendrier']}
            style={style}
            onKeyDown={surTouche}
            onBlur={(evenement) => {
              const vers = evenement.relatedTarget
              if (
                vers instanceof Node &&
                (surface.current?.contains(vers) === true ||
                  bouton.current?.contains(vers) === true)
              ) {
                return
              }
              if (vers !== null) setOuvert(false)
            }}
          >
            <div className={styles['entete']}>
              <button
                type="button"
                className={styles['navigation']}
                aria-label={textes.precedent}
                onClick={() => {
                  deplacer(ajouterMois(courant, -1))
                }}
              >
                <ChevronLeft aria-hidden="true" className={styles['chevron']} />
              </button>
              <p aria-live="polite" className={classes(styles['mois'], 'texte-corps-16')}>
                {libelleMois(courant)}
              </p>
              <button
                type="button"
                className={styles['navigation']}
                aria-label={textes.suivant}
                onClick={() => {
                  deplacer(ajouterMois(courant, 1))
                }}
              >
                <ChevronRight aria-hidden="true" className={styles['chevron']} />
              </button>
            </div>
            <div role="grid" aria-label={libelleMois(courant)} className={styles['grille']}>
              <div role="row" className={styles['semaine']}>
                {SEMAINE.map(({ nom, court }) => (
                  <span
                    key={nom}
                    role="columnheader"
                    aria-label={nom}
                    className={classes(styles['jourSemaine'], 'texte-legende-12')}
                  >
                    {court}
                  </span>
                ))}
              </div>
              {grille.map((semaine) => (
                <div key={formater(semaine[0] ?? courant)} role="row" className={styles['semaine']}>
                  {semaine.map((jour) => {
                    const estCourant = memeJour(jour, courant)
                    const estChoisi = choisi !== null && memeJour(jour, choisi)
                    const estAujourdhui = jourAujourdhui !== null && memeJour(jour, jourAujourdhui)
                    return (
                      <div key={formater(jour)} role="gridcell" aria-selected={estChoisi}>
                        <button
                          type="button"
                          tabIndex={estCourant ? 0 : -1}
                          data-jour=""
                          data-courant={estCourant ? '' : undefined}
                          data-autre-mois={jour.mois !== courant.mois ? '' : undefined}
                          data-aujourdhui={estAujourdhui ? '' : undefined}
                          aria-label={libelleLong(jour)}
                          aria-current={estAujourdhui ? 'date' : undefined}
                          aria-pressed={estChoisi}
                          className={classes(styles['jour'], 'texte-petit-14')}
                          onClick={() => {
                            choisir(jour)
                          }}
                        >
                          {jour.jour}
                        </button>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
            <div className={styles['pied']}>
              <button
                type="button"
                className={classes(styles['action'], 'texte-petit-14')}
                disabled={choisi === null}
                onClick={() => {
                  onChange('')
                  rendreLeFocus()
                }}
              >
                {textes.effacer}
              </button>
              <button
                type="button"
                className={classes(styles['action'], 'texte-petit-14')}
                disabled={jourAujourdhui === null}
                onClick={() => {
                  if (jourAujourdhui !== null) choisir(jourAujourdhui)
                }}
              >
                {textes.aujourdhui}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
