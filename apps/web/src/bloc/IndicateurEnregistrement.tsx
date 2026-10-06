import styles from './Bloc.module.css'
import { TEXTES_BLOC } from './textes.ts'
import type { EtatIndicateur } from '../envoi/indicateur.ts'
import { textesEnvoi } from '../envoi/indicateur.ts'

/** À droite de la barre : « ✓ Enregistré », ou le nombre de réponses gardées en attendant le réseau. */
export function IndicateurEnregistrement({
  etat,
  gardees,
}: {
  readonly etat: EtatIndicateur
  readonly gardees: number
}) {
  return (
    <span
      aria-live="polite"
      className={`${styles['enregistre'] ?? ''} ${etat === 'attente' ? (styles['enAttente'] ?? '') : ''} texte-legende-12`}
    >
      {etat === 'attente' ? textesEnvoi(gardees) : TEXTES_BLOC.enregistre}
    </span>
  )
}
