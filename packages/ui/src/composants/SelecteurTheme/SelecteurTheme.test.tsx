import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { Theme } from '../../theme.ts'
import { axe } from '../../tests/axe.ts'
import { SelecteurTheme } from './SelecteurTheme.tsx'

function Controle({ depart }: { readonly depart: Theme }) {
  const [theme, setTheme] = useState<Theme>(depart)
  return <SelecteurTheme valeur={theme} onChange={setTheme} />
}

describe('SelecteurTheme', () => {
  it('est un groupe radio avec Clair, Sombre et Système', () => {
    render(<SelecteurTheme valeur="clair" onChange={vi.fn()} />)
    expect(screen.getByRole('radiogroup', { name: 'Thème' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual([
      'clair',
      'sombre',
      'systeme',
    ])
    expect(screen.getByRole('radio', { name: 'Clair' })).toBeChecked()
  })

  it('appelle onChange avec la valeur choisie au clic', async () => {
    const auChangement = vi.fn()
    render(<SelecteurTheme valeur="clair" onChange={auChangement} />)

    await userEvent.setup().click(screen.getByRole('radio', { name: 'Système' }))

    expect(auChangement).toHaveBeenCalledWith('systeme')
  })

  it('se règle aux flèches du clavier, comme un groupe radio natif', async () => {
    const utilisateur = userEvent.setup()
    render(<Controle depart="clair" />)

    await utilisateur.tab()
    await utilisateur.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Sombre' })).toBeChecked()
    await utilisateur.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Système' })).toBeChecked()
    await utilisateur.keyboard('{ArrowLeft}')
    expect(screen.getByRole('radio', { name: 'Sombre' })).toBeChecked()
  })

  it('n’a aucune violation d’accessibilité', async () => {
    const { container } = render(<SelecteurTheme valeur="sombre" onChange={vi.fn()} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
