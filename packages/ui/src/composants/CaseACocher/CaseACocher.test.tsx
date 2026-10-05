import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from '../../tests/axe.ts'
import { describe, expect, it, vi } from 'vitest'
import { CaseACocher } from './CaseACocher.tsx'

describe('CaseACocher', () => {
  it('est une vraie case à cocher nommée par son libellé', () => {
    render(<CaseACocher libelle="Rester connecté sur cet appareil" />)
    expect(
      screen.getByRole('checkbox', { name: 'Rester connecté sur cet appareil' }),
    ).not.toBeChecked()
  })

  it('se coche en cliquant sur le libellé', async () => {
    const auChangement = vi.fn()
    render(<CaseACocher libelle="Rester connecté" onChange={auChangement} />)

    await userEvent.setup().click(screen.getByText('Rester connecté'))

    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(auChangement).toHaveBeenCalledTimes(1)
  })

  it('se coche au clavier avec la barre d’espace', async () => {
    const utilisateur = userEvent.setup()
    render(<CaseACocher libelle="Rester connecté" />)

    await utilisateur.tab()
    await utilisateur.keyboard(' ')

    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('respecte l’état coché fourni', () => {
    render(<CaseACocher libelle="Rester connecté" defaultChecked />)
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('désactivée, elle ne change pas', async () => {
    render(<CaseACocher libelle="Rester connecté" disabled />)

    await userEvent.setup().click(screen.getByText('Rester connecté'))

    expect(screen.getByRole('checkbox')).toBeDisabled()
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it("n'a aucune violation d'accessibilité", async () => {
    const { container } = render(<CaseACocher libelle="Rester connecté" defaultChecked />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
