import { Minus, Plus } from 'lucide-react'
import { useId, useState } from 'react'
import { classes } from '../../utilitaires/classes.ts'
import { ZoneDeTexte } from '../ZoneDeTexte/ZoneDeTexte.tsx'
import styles from './NoteSeance.module.css'

export interface ProprietesNoteSeance {
  readonly compris: string
  readonly bloque: string
  readonly onChangeCompris: (texte: string) => void
  readonly onChangeBloque: (texte: string) => void
  /** Affiche « Enregistré » à côté du titre. */
  readonly enregistre?: boolean
  readonly deplieParDefaut?: boolean
  readonly className?: string
}

/** Note libre de fin de séance : deux zones de texte, repliées par défaut. */
export function NoteSeance({
  compris,
  bloque,
  onChangeCompris,
  onChangeBloque,
  enregistre = false,
  deplieParDefaut = false,
  className,
}: ProprietesNoteSeance) {
  const idContenu = useId()
  const [deplie, setDeplie] = useState(deplieParDefaut)
  const Icone = deplie ? Minus : Plus

  return (
    <section className={classes(styles['note'], className)}>
      <div className={styles['entete']}>
        <button
          type="button"
          className={styles['bouton']}
          aria-expanded={deplie}
          aria-controls={idContenu}
          onClick={() => {
            setDeplie((courant) => !courant)
          }}
        >
          <span className="texte-petit-14">Ma note</span>
          <Icone className={styles['icone']} aria-hidden="true" />
        </button>
        {enregistre && (
          <span role="status" className={classes(styles['enregistre'], 'texte-legende-12')}>
            Enregistré
          </span>
        )}
      </div>
      <div id={idContenu} className={styles['contenu']} hidden={!deplie}>
        <ZoneDeTexte
          libelle="Ce que j’ai compris"
          value={compris}
          onChange={(evenement) => {
            onChangeCompris(evenement.currentTarget.value)
          }}
        />
        <ZoneDeTexte
          libelle="Ce qui bloque encore"
          value={bloque}
          onChange={(evenement) => {
            onChangeBloque(evenement.currentTarget.value)
          }}
        />
      </div>
    </section>
  )
}
