import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from '../../tests/axe.ts'
import { describe, expect, it, vi } from 'vitest'
import { ChoixConfiance } from './ChoixConfiance.tsx'

describe('ChoixConfiance', () => {
  it('propose Sûr, Hésitant et Au hasard', () => {
    render(<ChoixConfiance valeur={null} onChange={vi.fn()} />)
    expect(screen.getAllByRole('radio').map((r) => r.parentElement?.textContent)).toEqual([
      'Sûr',
      'Hésitant',
      'Au hasard',
    ])
  })

  it("n'a aucun choix tant que la valeur est null", () => {
    render(<ChoixConfiance valeur={null} onChange={vi.fn()} />)
    for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked()
  })

  it('coche la valeur reçue', () => {
    render(<ChoixConfiance valeur="hesitant" onChange={vi.fn()} />)
    expect(screen.getByRole('radio', { name: 'Hésitant' })).toBeChecked()
  })

  it('appelle onChange au clic', async () => {
    const onChange = vi.fn()
    render(<ChoixConfiance valeur={null} onChange={onChange} />)
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Au hasard' }))
    expect(onChange).toHaveBeenCalledWith('hasard')
  })

  it('se pilote au clavier avec Tab et les flèches', async () => {
    const onChange = vi.fn()
    render(<ChoixConfiance valeur={null} onChange={onChange} />)
    const utilisateur = userEvent.setup()
    await utilisateur.tab()
    expect(screen.getByRole('radio', { name: 'Sûr' })).toHaveFocus()
    await utilisateur.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('hesitant')
  })

  it('signale le champ obligatoire', () => {
    render(<ChoixConfiance valeur={null} onChange={vi.fn()} obligatoire />)
    expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-required', 'true')
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeRequired()
  })

  it("n'a aucune violation d'accessibilité", async () => {
    const { container } = render(<ChoixConfiance valeur="sur" onChange={vi.fn()} obligatoire />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
