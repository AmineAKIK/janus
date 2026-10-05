import type { ReactNode } from 'react'
import styles from './Sections.module.css'

interface ProprietesSectionVitrine {
  readonly identifiant: string
  readonly titre: string
  readonly children: ReactNode
}

export function SectionVitrine({ identifiant, titre, children }: ProprietesSectionVitrine) {
  return (
    <section className={styles['section']} aria-labelledby={identifiant}>
      <h2 id={identifiant} className="texte-titre-22">
        {titre}
      </h2>
      {children}
    </section>
  )
}

interface ProprietesEtat {
  readonly nom: string
  readonly children: ReactNode
}

/** Un état à montrer, avec son nom. Les états survol, appui et focus sont reproduits par des classes `etat-demo-*`. */
export function Etat({ nom, children }: ProprietesEtat) {
  return (
    <div className={styles['etat']}>
      <span className="texte-legende-12">{nom}</span>
      {children}
    </div>
  )
}
