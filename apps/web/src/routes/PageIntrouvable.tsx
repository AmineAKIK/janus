import { Bouton } from '@janus/ui'
import { Link, useRouter } from '@tanstack/react-router'
import { TITRE_INTROUVABLE } from './ecrans.ts'
import { PageProvisoire } from './PageProvisoire.tsx'

export function PageIntrouvable() {
  const routeur = useRouter()
  return (
    <>
      <PageProvisoire titre={TITRE_INTROUVABLE} />
      <p className="texte-corps-16">
        <Link to="/">Aller à Aujourd’hui</Link>
      </p>
      <p className="texte-corps-16">
        <Bouton
          type="button"
          variante="secondaire"
          onClick={() => {
            routeur.history.back()
          }}
        >
          Retour
        </Bouton>
      </p>
    </>
  )
}
