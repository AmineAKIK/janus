import { render, screen } from '@testing-library/react'
import { axe } from '../../tests/axe.ts'
import { describe, expect, it } from 'vitest'
import { CarteZone } from './CarteZone.tsx'

describe('CarteZone', () => {
  it('nomme la zone par son titre', () => {
    render(<CarteZone titre="Cette semaine">Contenu</CarteZone>)
    expect(screen.getByRole('region', { name: 'Cette semaine' })).toHaveTextContent('Contenu')
  })

  it("affiche l'action seulement quand elle est fournie", () => {
    const { rerender } = render(<CarteZone titre="Zone">Contenu</CarteZone>)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    rerender(
      <CarteZone titre="Zone" action={<a href="#tout">Voir tout</a>}>
        Contenu
      </CarteZone>,
    )
    expect(screen.getByRole('link', { name: 'Voir tout' })).toBeInTheDocument()
  })

  it("n'a aucune violation d'accessibilité", async () => {
    const { container } = render(
      <CarteZone titre="Zone" action={<a href="#tout">Voir tout</a>}>
        Contenu
      </CarteZone>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
