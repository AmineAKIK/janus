import type { Statut } from '@janus/contrats'
import { classes } from '../../utilitaires/classes.ts'
import type { RendreLien } from '../../utilitaires/lien.ts'
import { BadgeStatut } from '../BadgeStatut/BadgeStatut.tsx'
import styles from './NoeudBloc.module.css'

export interface ProprietesNoeudBloc {
  readonly code: string
  /** Titre du bloc : lu par les lecteurs d'écran, il n'a pas de place dans le carré. */
  readonly libelle: string
  readonly statut: Statut
  readonly lien: RendreLien
  readonly className?: string
}

const COULEURS_STATUT: Record<Statut, string> = {
  non_commence: 'nonCommence',
  en_cours: 'enCours',
  vu: 'vu',
  acquis_provisoirement: 'acquisProvisoirement',
  acquis: 'acquis',
  maitrise: 'maitrise',
  a_reprendre: 'aReprendre',
}

/** Un carré de la grille d'un module : l'indicateur de statut et le code, coloré par statut. */
export function NoeudBloc({ code, libelle, statut, lien, className }: ProprietesNoeudBloc) {
  return lien({
    className: classes(styles['noeud'], styles[COULEURS_STATUT[statut]], className),
    children: (
      <>
        <BadgeStatut statut={statut} taille="compacte" className={classes(styles['badge'])} />
        <span className={classes(styles['code'], 'texte-legende-12')}>{code}</span>
        <span className={styles['cache']}>{libelle}</span>
      </>
    ),
  })
}
