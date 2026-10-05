import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from '../../tests/axe.ts'
import { describe, expect, it, vi } from 'vitest'
import { ChampTexte } from './ChampTexte.tsx'

describe('ChampTexte', () => {
  it('lie le libellé au champ', async () => {
    render(<ChampTexte libelle="Nom d'utilisateur" />)
    const champ = screen.getByLabelText("Nom d'utilisateur")

    await userEvent.setup().type(champ, 'amine')

    expect(champ).toHaveValue('amine')
  })

  it('relie le message au champ par aria-describedby, sans aria-invalid hors erreur', () => {
    render(<ChampTexte libelle="E-mail" message="Utilise ton adresse habituelle." />)
    const champ = screen.getByLabelText('E-mail')

    expect(champ).toHaveAccessibleDescription('Utilise ton adresse habituelle.')
    expect(champ).not.toHaveAttribute('aria-invalid')
  })

  it('en erreur : aria-invalid et message en couleur d’erreur', () => {
    render(<ChampTexte libelle="E-mail" message="Ce champ est obligatoire." erreur />)
    const champ = screen.getByLabelText('E-mail')

    expect(champ).toHaveAttribute('aria-invalid', 'true')
    expect(champ).toHaveAccessibleDescription('Ce champ est obligatoire.')
  })

  it('transmet les props natives de input', async () => {
    const auChangement = vi.fn()
    render(
      <ChampTexte
        libelle="Code"
        placeholder="Saisir une valeur"
        autoComplete="one-time-code"
        onChange={auChangement}
      />,
    )
    const champ = screen.getByPlaceholderText('Saisir une valeur')

    await userEvent.setup().type(champ, 'ab')

    expect(champ).toHaveAttribute('autocomplete', 'one-time-code')
    expect(auChangement).toHaveBeenCalledTimes(2)
  })

  it('désactivé, il ne prend pas la saisie', async () => {
    render(<ChampTexte libelle="Code" disabled />)
    const champ = screen.getByLabelText('Code')

    await userEvent.setup().type(champ, 'ab')

    expect(champ).toBeDisabled()
    expect(champ).toHaveValue('')
  })

  it("n'a aucune violation d'accessibilité", async () => {
    const { container } = render(
      <ChampTexte libelle="E-mail" message="Ce champ est obligatoire." erreur />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
