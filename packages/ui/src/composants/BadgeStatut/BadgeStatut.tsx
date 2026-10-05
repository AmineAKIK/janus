import type { Statut } from '@janus/contrats'
import { useId, useState } from 'react'
import { classes } from '../../utilitaires/classes.ts'
import styles from './BadgeStatut.module.css'
import { IndicateurStatut } from './IndicateurStatut.tsx'

export const LIBELLES_STATUT: Record<Statut, string> = {
  non_commence: 'Non commencé',
  en_cours: 'En cours',
  vu: 'Vu',
  acquis_provisoirement: 'Acquis provisoirement',
  acquis: 'Acquis',
  maitrise: 'Maîtrisé',
  a_reprendre: 'À reprendre',
}

/** Définitions courtes, tirées du tableau des statuts du cadrage. */
export const DEFINITIONS_STATUT: Record<Statut, string> = {
  non_commence: 'Aucun événement sur ce bloc.',
  en_cours: 'Le bloc est ouvert, la restitution n’est pas encore faite.',
  vu: 'Toutes les questions de restitution sont envoyées. C’est un exercice d’apprentissage, pas une preuve.',
  acquis_provisoirement:
    'La consolidation, faite plus tard sans rouvrir le cours, atteint le seuil de points.',
  acquis:
    'Une vérification valable, faite quelques jours plus tard, est réussie : explication, tâche et transfert.',
  maitrise: 'Un retest valable, bien plus tard, est réussi.',
  a_reprendre: 'Une erreur critique est ouverte. Ce statut prime sur tous les autres.',
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

export interface ProprietesBadgeStatut {
  readonly statut: Statut
  /** `compacte` : l'indicateur seul, le libellé reste lu par les lecteurs d'écran. */
  readonly taille?: 'compacte' | 'normale'
  /** Au survol et au focus, affiche la définition du statut. Échap la ferme. */
  readonly infobulle?: boolean
  readonly className?: string
}

export function BadgeStatut({
  statut,
  taille = 'normale',
  infobulle = false,
  className,
}: ProprietesBadgeStatut) {
  const idInfobulle = useId()
  const [ouverte, setOuverte] = useState(false)
  const compacte = taille === 'compacte'

  return (
    <span
      className={classes(
        styles['badge'],
        compacte ? styles['compacte'] : styles['normale'],
        styles[COULEURS_STATUT[statut]],
        className,
      )}
      {...(infobulle
        ? {
            tabIndex: 0,
            'aria-describedby': idInfobulle,
            onPointerEnter: () => {
              setOuverte(true)
            },
            onPointerLeave: () => {
              setOuverte(false)
            },
            onFocus: () => {
              setOuverte(true)
            },
            onBlur: () => {
              setOuverte(false)
            },
            onKeyDown: (evenement: { readonly key: string }) => {
              if (evenement.key === 'Escape') setOuverte(false)
            },
          }
        : {})}
    >
      <IndicateurStatut statut={statut} />
      <span
        className={classes(compacte ? styles['libelleCache'] : styles['libelle'], 'texte-petit-14')}
      >
        {LIBELLES_STATUT[statut]}
      </span>
      {infobulle && (
        <span
          id={idInfobulle}
          role="tooltip"
          className={classes(styles['infobulle'], ouverte && styles['ouverte'], 'texte-legende-12')}
        >
          {DEFINITIONS_STATUT[statut]}
        </span>
      )}
    </span>
  )
}
