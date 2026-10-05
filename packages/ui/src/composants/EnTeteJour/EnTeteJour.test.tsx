import { render, screen } from '@testing-library/react'
import { axe } from '../../tests/axe.ts'
import { describe, expect, it } from 'vitest'
import { EnTeteJour } from './EnTeteJour.tsx'

describe('EnTeteJour', () => {
  it('affiche la date comme titre et le résumé', () => {
    render(<EnTeteJour date="5 octobre" resume="3 blocs · 42 min" />)
    expect(screen.getByRole('heading', { name: '5 octobre' })).toBeInTheDocument()
    expect(screen.getByText('3 blocs · 42 min')).toBeInTheDocument()
  })

  it("n'a aucune violation d'accessibilité", async () => {
    const { container } = render(<EnTeteJour date="5 octobre" resume="3 blocs · 42 min" />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
