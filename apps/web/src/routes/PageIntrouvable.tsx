import { MarqueJanus } from '@janus/ui'
import { useRouterState } from '@tanstack/react-router'
import { TITRE_INTROUVABLE } from './ecrans.ts'
import { PageProvisoire } from './PageProvisoire.tsx'
import styles from './PageIntrouvable.module.css'

/** La navigation reste visible : la page ne propose rien d'autre qu'elle, elle dit seulement ce qui s'est passé. */
export function PageIntrouvable() {
  const adresse = useRouterState({ select: (etat) => etat.location.pathname })
  return (
    <div className={styles['page']}>
      <MarqueJanus taille={72} className={styles['marque']} />
      <p className={`${styles['code'] ?? ''} texte-petit-14`}>Erreur 404</p>
      <PageProvisoire titre={TITRE_INTROUVABLE} />
      <p className={`${styles['adresse'] ?? ''} texte-corps-16`}>{adresse}</p>
      <p className={`${styles['explication'] ?? ''} texte-corps-16`}>
        Cette adresse n’existe pas ou plus. Reprends ton chemin depuis le menu.
      </p>
    </div>
  )
}
