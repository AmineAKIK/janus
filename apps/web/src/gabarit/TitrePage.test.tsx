import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TitrePage } from './TitrePage.tsx'

describe('TitrePage', () => {
  it('est un h1 que le gabarit peut focaliser par programme', () => {
    render(<TitrePage>Journal</TitrePage>)

    const titre = screen.getByRole('heading', { level: 1, name: 'Journal' })
    expect(titre).toHaveAttribute('tabindex', '-1')
    titre.focus()
    expect(titre).toHaveFocus()
  })

  it('prend le grand titre par défaut, une autre taille et la classe de l’écran sur demande', () => {
    const { rerender } = render(<TitrePage>Journal</TitrePage>)
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('texte-titre-28')

    rerender(
      <TitrePage taille="texte-corps-16" className="a-moi">
        Journal
      </TitrePage>,
    )
    const titre = screen.getByRole('heading', { level: 1 })
    expect(titre).toHaveClass('texte-corps-16', 'a-moi')
    expect(titre).not.toHaveClass('texte-titre-28')
  })
})
