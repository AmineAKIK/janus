import type { Statut } from '@janus/contrats'
import { TriangleAlert } from 'lucide-react'
import styles from './BadgeStatut.module.css'

/** Part du disque remplie, de 0 à 1 : la forme change avec le statut, pas seulement la couleur. */
const REMPLISSAGE: Partial<Record<Statut, string>> = {
  en_cours: 'M10 10 L10 2 A8 8 0 0 1 18 10 Z',
  vu: 'M10 10 L10 2 A8 8 0 0 1 10 18 Z',
  acquis_provisoirement: 'M10 10 L10 2 A8 8 0 1 1 2 10 Z',
}

interface ProprietesIndicateur {
  readonly statut: Statut
}

export function IndicateurStatut({ statut }: ProprietesIndicateur) {
  if (statut === 'a_reprendre') {
    return <TriangleAlert className={styles['indicateur']} aria-hidden={true} />
  }
  const remplissage = REMPLISSAGE[statut]
  return (
    <svg className={styles['indicateur']} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      {statut === 'acquis' || statut === 'maitrise' ? (
        <circle cx="10" cy="10" r="9" fill="currentColor" />
      ) : (
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      )}
      {remplissage !== undefined && <path d={remplissage} fill="currentColor" />}
      {statut === 'maitrise' && (
        <>
          <circle
            cx="10"
            cy="10"
            r="5"
            fill="none"
            stroke="var(--couleur-surface)"
            strokeWidth="1.5"
          />
          <circle cx="10" cy="10" r="1.75" fill="var(--couleur-surface)" />
        </>
      )}
    </svg>
  )
}
