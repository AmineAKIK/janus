import type { Statut } from '@janus/contrats'
import { classes } from '../../utilitaires/classes.ts'
import type { RendreLien } from '../../utilitaires/lien.ts'
import { BadgeStatut } from '../BadgeStatut/BadgeStatut.tsx'
import styles from './NoeudBloc.module.css'

export interface ProprietesNoeudBloc {
  readonly code: string
  readonly libelle: string
  readonly statut: Statut
  readonly lien: RendreLien
  readonly className?: string
}

/** Un bloc dans la grille d'un module : l'indicateur de statut, le code et le libellé. */
export function NoeudBloc({ code, libelle, statut, lien, className }: ProprietesNoeudBloc) {
  return lien({
    className: classes(styles['noeud'], className),
    children: (
      <>
        <BadgeStatut statut={statut} taille="compacte" className={classes(styles['badge'])} />
        <span className={classes(styles['code'], 'texte-code-14')}>{code}</span>
        <span className={classes(styles['libelle'], 'texte-petit-14')}>{libelle}</span>
      </>
    ),
  })
}
