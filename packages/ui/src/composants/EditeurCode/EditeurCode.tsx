import type { ChangeEvent, ComponentProps, KeyboardEvent } from 'react'
import { useId, useRef, useState } from 'react'
import { classes } from '../../utilitaires/classes.ts'
import styles from './EditeurCode.module.css'
import { desindenter, indenter } from './raccourcis.ts'
import type { Edition } from './raccourcis.ts'

export interface ProprietesEditeurCode extends Omit<
  ComponentProps<'textarea'>,
  'children' | 'value' | 'onChange' | 'defaultValue'
> {
  readonly libelle: string
  readonly value: string
  readonly onChange: (valeur: string) => void
}

/**
 * Un `textarea` mono-espacé avec ses numéros de ligne. Tab insère deux espaces, Maj+Tab les retire ;
 * après Échap, Tab quitte le champ comme d'habitude (le piège au clavier est levé).
 */
export function EditeurCode({
  libelle,
  value,
  onChange,
  id,
  className,
  readOnly,
  ...proprietes
}: ProprietesEditeurCode) {
  const idAuto = useId()
  const idChamp = id ?? idAuto
  const zone = useRef<HTMLTextAreaElement>(null)
  const numeros = useRef<HTMLOListElement>(null)
  const [libre, setLibre] = useState(false)
  const lignes = value.split('\n').length

  function appliquer(edition: Edition) {
    onChange(edition.valeur)
    // Le curseur est posé une fois la valeur recopiée dans le champ.
    requestAnimationFrame(() => {
      zone.current?.setSelectionRange(edition.debut, edition.fin)
    })
  }

  function auClavier(evenement: KeyboardEvent<HTMLTextAreaElement>) {
    if (evenement.key === 'Escape') {
      setLibre(true)
      return
    }
    if (evenement.key !== 'Tab' || evenement.ctrlKey || evenement.metaKey || evenement.altKey) {
      setLibre(false)
      return
    }
    if (libre || readOnly === true) return
    evenement.preventDefault()
    const { selectionStart: debut, selectionEnd: fin } = evenement.currentTarget
    appliquer((evenement.shiftKey ? desindenter : indenter)({ valeur: value, debut, fin }))
  }

  return (
    <div className={classes(styles['editeur'], className)}>
      <label htmlFor={idChamp} className={classes(styles['libelle'], 'texte-petit-14')}>
        {libelle}
      </label>
      <div className={styles['cadre']}>
        <ol ref={numeros} className={styles['numeros']} aria-hidden="true">
          {Array.from({ length: lignes }, (_, rang) => (
            <li key={rang} />
          ))}
        </ol>
        <textarea
          {...proprietes}
          ref={zone}
          id={idChamp}
          value={value}
          readOnly={readOnly}
          rows={Math.max(lignes, 6)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          wrap="off"
          className={styles['saisie']}
          onChange={(evenement: ChangeEvent<HTMLTextAreaElement>) => {
            onChange(evenement.currentTarget.value)
          }}
          onKeyDown={auClavier}
          onBlur={() => {
            setLibre(false)
          }}
          onScroll={(evenement) => {
            if (numeros.current !== null)
              numeros.current.style.translate = `0 -${String(evenement.currentTarget.scrollTop)}px`
          }}
        />
      </div>
    </div>
  )
}
