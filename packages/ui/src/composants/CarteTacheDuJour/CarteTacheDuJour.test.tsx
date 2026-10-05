import { render, screen } from '@testing-library/react'
import { axe } from '../../tests/axe.ts'
import { describe, expect, it } from 'vitest'
import { CarteTacheDuJour } from './CarteTacheDuJour.tsx'

describe('CarteTacheDuJour', () => {
  it.each([
    ['revision', 'Révision'],
    ['restitution', 'Restitution'],
    ['preuve', 'Preuve'],
  ] as const)('affiche le type %s', (type, libelle) => {
    render(
      <CarteTacheDuJour
        type={type}
        titre="Titre"
        action={<button type="button">Commencer</button>}
      />,
    )
    expect(screen.getByText(libelle)).toBeInTheDocument()
  })

  it('affiche le titre, la description et l’action', () => {
    render(
      <CarteTacheDuJour
        type="revision"
        titre="3 notions à revoir"
        description="Dix minutes suffisent."
        action={<button type="button">Commencer</button>}
      />,
    )
    expect(screen.getByRole('heading', { name: '3 notions à revoir' })).toBeInTheDocument()
    expect(screen.getByText('Dix minutes suffisent.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Commencer' })).toBeInTheDocument()
  })

  it("n'a aucune violation d'accessibilité", async () => {
    const { container } = render(
      <CarteTacheDuJour
        type="preuve"
        titre="Titre"
        action={<button type="button">Commencer</button>}
      />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
