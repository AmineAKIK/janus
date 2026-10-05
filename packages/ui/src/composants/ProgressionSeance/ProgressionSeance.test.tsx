import { render, screen } from '@testing-library/react'
import { axe } from '../../tests/axe.ts'
import { describe, expect, it } from 'vitest'
import { ProgressionSeance, type EtapeSeance } from './ProgressionSeance.tsx'

const ETAPES: readonly EtapeSeance[] = [
  { libelle: 'Carte', etat: 'termine' },
  { libelle: 'Pourquoi', etat: 'en_cours' },
  { libelle: 'Image', etat: 'a_commencer' },
]

describe('ProgressionSeance', () => {
  it("affiche le rang de l'étape en cours", () => {
    render(<ProgressionSeance etapes={ETAPES} />)
    expect(screen.getByText('2 sur 3')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
  })

  it("marque l'étape en cours avec aria-current", () => {
    render(<ProgressionSeance etapes={ETAPES} />)
    const courante = screen.getByRole('listitem', { current: 'step' })
    expect(courante).toHaveTextContent('Pourquoi')
    expect(screen.getAllByRole('listitem', { current: false })).toHaveLength(2)
  })

  it("dit l'état de chaque étape", () => {
    render(<ProgressionSeance etapes={ETAPES} />)
    expect(screen.getByText(/Carte/)).toHaveTextContent('terminée')
    expect(screen.getByText(/Image/)).toHaveTextContent('à commencer')
  })

  it('affiche N sur N quand tout est terminé', () => {
    render(<ProgressionSeance etapes={ETAPES.map((e) => ({ ...e, etat: 'termine' as const }))} />)
    expect(screen.getByText('3 sur 3')).toBeInTheDocument()
  })

  it('affiche 1 sur N quand rien ne commence', () => {
    render(
      <ProgressionSeance etapes={ETAPES.map((e) => ({ ...e, etat: 'a_commencer' as const }))} />,
    )
    expect(screen.getByText('1 sur 3')).toBeInTheDocument()
  })

  it("préfère l'étape en cours à une étape à commencer placée avant", () => {
    render(
      <ProgressionSeance
        etapes={[
          { libelle: 'A', etat: 'a_commencer' },
          { libelle: 'B', etat: 'en_cours' },
        ]}
      />,
    )
    expect(screen.getByText('2 sur 2')).toBeInTheDocument()
  })

  it("n'a aucune violation d'accessibilité", async () => {
    const { container } = render(<ProgressionSeance etapes={ETAPES} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
