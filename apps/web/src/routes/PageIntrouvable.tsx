import { Bouton } from '@janus/ui'
import { Link, useRouter } from '@tanstack/react-router'
import { TITRE_INTROUVABLE } from './ecrans.ts'
import { PageProvisoire } from './PageProvisoire.tsx'
import styles from './PageIntrouvable.module.css'

export function PageIntrouvable() {
  const routeur = useRouter()
  return (
    <div className={styles['page']}>
      <p className={`${styles['code'] ?? ''} texte-petit-14`}>Erreur 404</p>
      <PageProvisoire titre={TITRE_INTROUVABLE} />
      <p className={`${styles['explication'] ?? ''} texte-corps-16`}>
        L’adresse est peut-être ancienne ou mal écrite.
      </p>
      <div className={styles['actions']}>
        <Link to="/" className={`${styles['principal'] ?? ''} texte-corps-16`}>
          Aller à Aujourd’hui
        </Link>
        <Bouton
          type="button"
          variante="secondaire"
          onClick={() => {
            routeur.history.back()
          }}
        >
          Retour
        </Bouton>
      </div>
    </div>
  )
}
