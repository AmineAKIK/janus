import { render, screen } from '@testing-library/react'
import { axe } from '../../tests/axe.ts'
import { describe, expect, it } from 'vitest'
import { EtatVideZone } from './EtatVideZone.tsx'

describe('EtatVideZone', () => {
  it('affiche le message', () => {
    render(<EtatVideZone message="Rien à montrer pour l’instant." />)
    expect(screen.getByText('Rien à montrer pour l’instant.')).toBeInTheDocument()
  })

  it("n'a aucune violation d'accessibilité", async () => {
    const { container } = render(<EtatVideZone message="Message" />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
