import type { Statut } from '@janus/contrats'
import { BadgeStatut, LIBELLES_STATUT } from '@janus/ui'
import styles from './RepartitionStatuts.module.css'

/** La barre : un segment par bloc, coloré par son statut. Le texte voisin porte le chiffre. */
export function RepartitionStatuts({
  statuts,
  fine = false,
}: {
  readonly statuts: readonly Statut[]
  readonly fine?: boolean
}) {
  return (
    <div
      className={`${styles['barre'] ?? ''} ${fine ? (styles['fine'] ?? '') : ''}`}
      aria-hidden="true"
    >
      {statuts.map((statut, index) => (
        // L'ordre du plan ne change pas pendant l'affichage : l'index est stable.
        <span key={index} className={styles['segment']} data-statut={statut} />
      ))}
    </div>
  )
}

/** Les statuts de la légende, par groupes : acquis, en chemin, pas commencé. */
const GROUPES_LEGENDE: readonly (readonly Statut[])[] = [
  ['acquis', 'acquis_provisoirement', 'maitrise'],
  ['a_reprendre', 'en_cours', 'vu'],
  ['non_commence'],
]

export function LegendeStatuts({ titre }: { readonly titre: string }) {
  return (
    <div role="group" aria-label={titre} className={styles['legende']}>
      {GROUPES_LEGENDE.map((groupe) => (
        <ul key={groupe.join()} className={styles['groupe']}>
          {groupe.map((statut) => (
            <li key={statut} className={`${styles['etat'] ?? ''} texte-legende-12`}>
              <BadgeStatut statut={statut} taille="compacte" />
              <span aria-hidden="true">{LIBELLES_STATUT[statut]}</span>
            </li>
          ))}
        </ul>
      ))}
    </div>
  )
}
