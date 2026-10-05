import type { Statut } from '@janus/contrats'
import { classes } from '../../utilitaires/classes.ts'
import type { RendreLien } from '../../utilitaires/lien.ts'
import { BadgeStatut } from '../BadgeStatut/BadgeStatut.tsx'
import styles from './CarteBloc.module.css'

export interface ProprietesCarteBloc {
  readonly code: string
  readonly titre: string
  readonly statut: Statut
  /** Date déjà formatée, ou `null` quand il n'y en a pas. */
  readonly prochaineDate: string | null
  /** Prérequis manquants : la carte est atténuée mais reste cliquable. */
  readonly grise?: boolean
  /** Toute la carte est ce lien : il n'y a pas d'autre lien dedans. */
  readonly lien: RendreLien
  readonly className?: string
}

export function CarteBloc({
  code,
  titre,
  statut,
  prochaineDate,
  grise = false,
  lien,
  className,
}: ProprietesCarteBloc) {
  return lien({
    className: classes(styles['carte'], grise && styles['grise'], className),
    children: (
      <>
        <span className={classes(styles['code'], 'texte-code-14')}>{code}</span>
        <span className={classes(styles['titre'], 'texte-sous-titre-18')}>{titre}</span>
        <BadgeStatut statut={statut} />
        {prochaineDate !== null && (
          <span className={classes(styles['secondaire'], 'texte-petit-14')}>
            {`Prochaine révision · ${prochaineDate}`}
          </span>
        )}
        {grise && (
          <span className={classes(styles['secondaire'], 'texte-petit-14')}>
            Prérequis manquants
          </span>
        )}
      </>
    ),
  })
}
