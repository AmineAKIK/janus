import { Link } from '@tanstack/react-router'
import { TITRE_INTROUVABLE } from './ecrans.ts'
import { PageProvisoire } from './PageProvisoire.tsx'

export function PageIntrouvable() {
  return (
    <>
      <PageProvisoire titre={TITRE_INTROUVABLE} />
      <p className="texte-corps-16">
        <Link to="/">Aller à Aujourd’hui</Link>
      </p>
    </>
  )
}
