import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { axe } from '../../tests/axe.ts'
import { EnTeteSection } from './EnTeteSection.tsx'

describe('EnTeteSection', () => {
  it('rend le titre en h2 et la description', () => {
    render(<EnTeteSection titre="Affichage" description="Thème et taille du texte" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Affichage' })).toBeInTheDocument()
    expect(screen.getByText('Thème et taille du texte')).toBeInTheDocument()
  })

  it('la description est facultative', () => {
    render(<EnTeteSection titre="Affichage" />)
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
    expect(screen.queryByText('Thème et taille du texte')).not.toBeInTheDocument()
  })

  it('n’a aucune violation d’accessibilité', async () => {
    const { container } = render(<EnTeteSection titre="Affichage" description="Description" />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
