import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { Taille } from '../../theme.ts'
import { axe } from '../../tests/axe.ts'
import { SelecteurTaille } from './SelecteurTaille.tsx'

function Controle({ depart }: { readonly depart: Taille }) {
  const [taille, setTaille] = useState<Taille>(depart)
  return <SelecteurTaille valeur={taille} onChange={setTaille} />
}

describe('SelecteurTaille', () => {
  it('est un groupe radio avec Petit, Standard et Grand', () => {
    render(<SelecteurTaille valeur="standard" onChange={vi.fn()} />)
    expect(screen.getByRole('radiogroup', { name: 'Taille du texte' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual([
      'petit',
      'standard',
      'grand',
    ])
    expect(screen.getByRole('radio', { name: 'Standard' })).toBeChecked()
  })

  it('appelle onChange avec la valeur choisie au clic', async () => {
    const auChangement = vi.fn()
    render(<SelecteurTaille valeur="standard" onChange={auChangement} />)

    await userEvent.setup().click(screen.getByRole('radio', { name: 'Grand' }))

    expect(auChangement).toHaveBeenCalledWith('grand')
  })

  it('se règle aux flèches du clavier', async () => {
    const utilisateur = userEvent.setup()
    render(<Controle depart="petit" />)

    await utilisateur.tab()
    await utilisateur.keyboard('{ArrowRight}{ArrowRight}')

    expect(screen.getByRole('radio', { name: 'Grand' })).toBeChecked()
  })

  it('n’a aucune violation d’accessibilité', async () => {
    const { container } = render(<SelecteurTaille valeur="grand" onChange={vi.fn()} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
