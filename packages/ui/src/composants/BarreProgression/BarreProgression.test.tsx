import { render, screen } from '@testing-library/react'
import { axe } from '../../tests/axe.ts'
import { describe, expect, it } from 'vitest'
import { BarreProgression } from './BarreProgression.tsx'

describe('BarreProgression', () => {
  it('expose les attributs de la barre', () => {
    render(<BarreProgression libelle="Progression" valeur={3} max={7} />)
    const barre = screen.getByRole('progressbar', { name: 'Progression' })
    expect(barre).toHaveAttribute('aria-valuemin', '0')
    expect(barre).toHaveAttribute('aria-valuemax', '7')
    expect(barre).toHaveAttribute('aria-valuenow', '3')
    expect(barre).toHaveAttribute('aria-valuetext', '3 sur 7')
    expect(screen.getByText('3 sur 7')).toBeInTheDocument()
  })

  it('accepte un texte de valeur personnalisé', () => {
    render(<BarreProgression libelle="Progression" valeur={2} max={7} texteValeur="3 sur 7" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '3 sur 7')
  })

  it.each([
    [-2, 5, '0'],
    [9, 5, '5'],
    [Number.NaN, 5, '0'],
    [3, 0, '0'],
  ])('borne %s sur %s à %s', (valeur, max, attendu) => {
    render(<BarreProgression libelle="P" valeur={valeur} max={max} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', attendu)
  })

  it("n'a aucune violation d'accessibilité", async () => {
    const { container } = render(<BarreProgression libelle="Progression" valeur={5} max={7} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
