import { classes } from '../../utilitaires/classes.ts'
import styles from './BarreProgression.module.css'

export interface ProprietesBarreProgression {
  readonly valeur: number
  readonly max: number
  /** Texte visible à gauche, et nom accessible de la barre. */
  readonly libelle: string
  /** Remplace « {valeur} sur {max} » à droite, et sert aussi de `aria-valuetext`. */
  readonly texteValeur?: string
  readonly className?: string
}

function normaliser(
  valeur: number,
  max: number,
): { readonly valeur: number; readonly max: number } {
  const maxValide = Number.isFinite(max) && max > 0 ? max : 0
  const valeurValide = Number.isFinite(valeur) ? valeur : 0
  return { valeur: Math.min(Math.max(valeurValide, 0), maxValide), max: maxValide }
}

export function BarreProgression({
  valeur,
  max: maxBrut,
  libelle,
  texteValeur,
  className,
}: ProprietesBarreProgression) {
  const { valeur: courante, max } = normaliser(valeur, maxBrut)
  const texte = texteValeur ?? `${String(courante)} sur ${String(max)}`
  const part = max > 0 ? (courante / max) * 100 : 0
  return (
    <div className={classes(styles['barre'], className)}>
      <div className={classes(styles['entete'], 'texte-petit-14')}>
        <span className={styles['libelle']}>{libelle}</span>
        <span className={styles['valeur']}>{texte}</span>
      </div>
      <div
        role="progressbar"
        aria-label={libelle}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={courante}
        aria-valuetext={texte}
        className={styles['piste']}
      >
        <div className={styles['remplissage']} style={{ inlineSize: `${String(part)}%` }} />
      </div>
    </div>
  )
}
