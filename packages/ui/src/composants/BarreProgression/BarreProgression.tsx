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

function borner(valeur: number, max: number): number {
  if (!Number.isFinite(valeur) || max <= 0) return 0
  return Math.min(Math.max(valeur, 0), max)
}

export function BarreProgression({
  valeur,
  max,
  libelle,
  texteValeur,
  className,
}: ProprietesBarreProgression) {
  const courante = borner(valeur, max)
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
