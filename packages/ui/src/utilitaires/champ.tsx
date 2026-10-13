import type { LucideIcon } from 'lucide-react'
import type { CSSProperties, KeyboardEvent, ReactNode, RefObject, Ref } from 'react'
import { createPortal } from 'react-dom'
import styles from './champ.module.css'
import { classes } from './classes.ts'
import { fermerSiFocusSort } from './surface.tsx'

interface ProprietesChampAvecLibelle {
  readonly libelle: string
  readonly libelleMasque: boolean
  readonly idLibelle: string
  readonly disabled: boolean
  readonly className: string | undefined
  /** Le contrôle, puis sa surface flottante. */
  readonly children: ReactNode
}

/** Enveloppe d'un champ à surface flottante : le libellé au-dessus, puis le contrôle. */
export function ChampAvecLibelle({
  libelle,
  libelleMasque,
  idLibelle,
  disabled,
  className,
  children,
}: ProprietesChampAvecLibelle) {
  return (
    <div className={classes(styles['champ'], disabled && styles['desactive'], className)}>
      <span
        id={idLibelle}
        className={classes(styles['libelle'], libelleMasque && styles['masque'], 'texte-petit-14')}
      >
        {libelle}
      </span>
      {children}
    </div>
  )
}

interface ProprietesDeclencheurDialogue {
  readonly ref: Ref<HTMLButtonElement>
  readonly id: string
  readonly idLibelle: string
  readonly ouvert: boolean
  readonly disabled: boolean
  readonly onClick: () => void
  readonly icone: LucideIcon
  /** Texte de la valeur courante ou, quand `vide`, du texte d'invite. */
  readonly texte: string
  readonly vide?: boolean
}

/** Bouton qui ouvre une boîte de dialogue flottante (calendrier, heure) et en montre la valeur. */
export function DeclencheurDialogue({
  ref,
  id,
  idLibelle,
  ouvert,
  disabled,
  onClick,
  icone: Icone,
  texte,
  vide = false,
}: ProprietesDeclencheurDialogue) {
  const idValeur = `${id}-valeur`
  return (
    <button
      ref={ref}
      id={id}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={ouvert}
      aria-labelledby={`${idLibelle} ${idValeur}`}
      disabled={disabled}
      className={classes(styles['bouton'], 'texte-corps-16')}
      onClick={onClick}
    >
      <span id={idValeur} className={classes(styles['valeur'], vide && styles['vide'])}>
        {texte}
      </span>
      <Icone aria-hidden="true" className={styles['icone']} />
    </button>
  )
}

interface ProprietesSurfaceDialogue {
  readonly surface: RefObject<HTMLDivElement | null>
  readonly ancre: RefObject<HTMLElement | null>
  /** Nom accessible de la boîte de dialogue. */
  readonly libelle: string
  readonly className: string | undefined
  /** Le style rendu par `useSurface`. */
  readonly style: CSSProperties
  readonly fermer: () => void
  readonly onKeyDown?: (evenement: KeyboardEvent<HTMLDivElement>) => void
  readonly children: ReactNode
}

/** Boîte de dialogue flottante, rendue dans `body` : se ferme quand le focus part ailleurs. */
export function SurfaceDialogue({
  surface,
  ancre,
  libelle,
  className,
  style,
  fermer,
  onKeyDown,
  children,
}: ProprietesSurfaceDialogue) {
  return createPortal(
    <div
      ref={surface}
      role="dialog"
      aria-label={libelle}
      className={className}
      style={style}
      onKeyDown={onKeyDown}
      onBlur={(evenement) => {
        fermerSiFocusSort(evenement, [surface, ancre], fermer)
      }}
    >
      {children}
    </div>,
    document.body,
  )
}
