import styles from './Bloc.module.css'
import { TEXTES_ENCARTS } from './textesManquants.ts'

/** Au-dessus de la fiche quand la consolidation n'est pas encore ouverte. */
export function EncartConsolidation({
  heure,
  delai,
}: {
  /** L'heure dite, déjà écrite (« 15 h 20 »). */
  readonly heure: string
  /** Le délai du réglage, déjà écrit (« 1 h »). */
  readonly delai: string
}) {
  return (
    <div className={styles['encart']} role="status">
      <p className={`${styles['encartTitre'] ?? ''} texte-corps-16`}>
        <span aria-hidden="true">● </span>
        {TEXTES_ENCARTS.consolidationTitre(heure)}
      </p>
      <p className={`${styles['encartTexte'] ?? ''} texte-petit-14`}>
        {TEXTES_ENCARTS.consolidationAide(delai)}
      </p>
    </div>
  )
}
