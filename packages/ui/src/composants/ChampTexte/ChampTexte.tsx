import { CircleAlert } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { useId } from 'react'
import { classes } from '../../utilitaires/classes.ts'
import styles from './ChampTexte.module.css'

export interface ProprietesChampTexte extends Omit<ComponentProps<'input'>, 'children'> {
  readonly libelle: string
  /** Message d'aide, ou d'erreur quand `erreur` est vrai. */
  readonly message?: string
  readonly erreur?: boolean
  /** Élément placé à droite dans le champ (par exemple le bouton œil du mot de passe). */
  readonly accessoire?: ReactNode
}

export function ChampTexte({
  libelle,
  message,
  erreur = false,
  accessoire,
  id,
  className,
  disabled,
  ...proprietes
}: ProprietesChampTexte) {
  const idAuto = useId()
  const idChamp = id ?? idAuto
  const idMessage = `${idChamp}-message`
  const aMessage = message !== undefined && message !== ''

  return (
    <div className={classes(styles['champ'], disabled === true && styles['desactive'], className)}>
      <label htmlFor={idChamp} className={classes(styles['libelle'], 'texte-petit-14')}>
        {libelle}
      </label>
      <div className={classes(styles['cadre'], erreur && styles['erreur'])}>
        <input
          {...proprietes}
          id={idChamp}
          disabled={disabled}
          aria-invalid={erreur ? 'true' : undefined}
          aria-describedby={aMessage ? idMessage : undefined}
          className={classes(styles['saisie'], 'texte-corps-16')}
        />
        {accessoire}
      </div>
      {aMessage && (
        <p
          id={idMessage}
          className={classes(
            styles['message'],
            erreur && styles['messageErreur'],
            'texte-legende-12',
          )}
        >
          {erreur && <CircleAlert className={styles['iconeMessage']} aria-hidden="true" />}
          {message}
        </p>
      )}
    </div>
  )
}
