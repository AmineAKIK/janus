import type { ChangeEvent, ComponentProps } from 'react'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import { classes } from '../../utilitaires/classes.ts'
import styles from './ZoneDeTexte.module.css'

export interface ProprietesZoneDeTexte extends Omit<ComponentProps<'textarea'>, 'children'> {
  readonly libelle: string
  readonly message?: string
  readonly erreur?: boolean
  /** Hauteur maximale en lignes, au-delà la zone défile. */
  readonly lignesMax?: number
  /** Limite indicative affichée dans le compteur. */
  readonly maxCaracteres?: number
}

function longueurInitiale(valeur: unknown): number {
  return typeof valeur === 'string' ? valeur.length : 0
}

/** Ajuste la hauteur au contenu réel ; la hauteur maximale est posée par le CSS. */
function ajusterHauteur(element: HTMLTextAreaElement) {
  element.style.height = 'auto'
  element.style.height = `${String(element.scrollHeight + element.offsetHeight - element.clientHeight)}px`
}

export function ZoneDeTexte({
  libelle,
  message,
  erreur = false,
  lignesMax = 12,
  maxCaracteres,
  id,
  className,
  disabled,
  onChange,
  value,
  defaultValue,
  ...proprietes
}: ProprietesZoneDeTexte) {
  const idAuto = useId()
  const idChamp = id ?? idAuto
  const idMessage = `${idChamp}-message`
  const idCompteur = `${idChamp}-compteur`
  const aMessage = message !== undefined && message !== ''
  const zone = useRef<HTMLTextAreaElement>(null)
  const [longueur, setLongueur] = useState(longueurInitiale(value ?? defaultValue))
  const longueurAffichee = value === undefined ? longueur : longueurInitiale(value)

  // Recalcul à chaque changement de valeur contrôlée, de lignesMax et au premier rendu.
  useLayoutEffect(() => {
    if (zone.current !== null) ajusterHauteur(zone.current)
  }, [value, lignesMax])

  const aDecrire = [aMessage ? idMessage : null, maxCaracteres !== undefined ? idCompteur : null]
    .filter((identifiant) => identifiant !== null)
    .join(' ')

  const auChangement = (evenement: ChangeEvent<HTMLTextAreaElement>) => {
    setLongueur(evenement.currentTarget.value.length)
    ajusterHauteur(evenement.currentTarget)
    onChange?.(evenement)
  }

  return (
    <div className={classes(styles['champ'], disabled === true && styles['desactive'], className)}>
      <label htmlFor={idChamp} className={classes(styles['libelle'], 'texte-petit-14')}>
        {libelle}
      </label>
      <textarea
        {...proprietes}
        {...(value === undefined ? {} : { value })}
        {...(defaultValue === undefined ? {} : { defaultValue })}
        ref={zone}
        id={idChamp}
        rows={3}
        disabled={disabled}
        onChange={auChangement}
        aria-invalid={erreur ? 'true' : undefined}
        aria-describedby={aDecrire === '' ? undefined : aDecrire}
        className={classes(styles['saisie'], erreur && styles['erreur'], 'texte-corps-16')}
        style={{
          maxHeight: `calc(${String(lignesMax)} * 1.5rem + 2 * var(--espacement-12) + 2px)`,
        }}
      />
      <div className={styles['pied']}>
        {aMessage && (
          <p
            id={idMessage}
            className={classes(
              styles['message'],
              erreur && styles['messageErreur'],
              'texte-legende-12',
            )}
          >
            {message}
          </p>
        )}
        {maxCaracteres !== undefined && (
          <p
            id={idCompteur}
            className={classes(
              styles['compteur'],
              longueurAffichee > maxCaracteres && styles['messageErreur'],
              'texte-legende-12',
            )}
          >
            {`${String(longueurAffichee)} / ${String(maxCaracteres)}`}
          </p>
        )}
      </div>
    </div>
  )
}
