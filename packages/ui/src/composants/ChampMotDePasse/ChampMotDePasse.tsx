import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { ChampTexte, type ProprietesChampTexte } from '../ChampTexte/ChampTexte.tsx'
import styles from './ChampMotDePasse.module.css'

export type ProprietesChampMotDePasse = Omit<ProprietesChampTexte, 'type' | 'accessoire'>

export function ChampMotDePasse({ disabled, ...proprietes }: ProprietesChampMotDePasse) {
  const [visible, setVisible] = useState(false)
  const Icone = visible ? EyeOff : Eye

  return (
    <ChampTexte
      {...proprietes}
      disabled={disabled}
      type={visible ? 'text' : 'password'}
      accessoire={
        <button
          type="button"
          className={styles['bascule']}
          aria-label="Afficher le mot de passe"
          aria-pressed={visible}
          disabled={disabled}
          onClick={() => {
            setVisible((valeur) => !valeur)
          }}
        >
          <Icone className={styles['icone']} aria-hidden="true" />
        </button>
      }
    />
  )
}
