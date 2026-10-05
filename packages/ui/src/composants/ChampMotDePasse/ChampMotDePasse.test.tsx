import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from '../../tests/axe.ts'
import { describe, expect, it } from 'vitest'
import { ChampMotDePasse } from './ChampMotDePasse.tsx'

describe('ChampMotDePasse', () => {
  it('masque la saisie par défaut', () => {
    render(<ChampMotDePasse libelle="Mot de passe" />)
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('type', 'password')
  })

  it('le bouton œil bascule entre password et text, avec aria-pressed', async () => {
    const utilisateur = userEvent.setup()
    render(<ChampMotDePasse libelle="Mot de passe" />)
    const champ = screen.getByLabelText('Mot de passe')
    const bascule = screen.getByRole('button', { name: 'Afficher le mot de passe' })

    expect(bascule).toHaveAttribute('aria-pressed', 'false')

    await utilisateur.click(bascule)
    expect(champ).toHaveAttribute('type', 'text')
    expect(bascule).toHaveAttribute('aria-pressed', 'true')

    await utilisateur.click(bascule)
    expect(champ).toHaveAttribute('type', 'password')
    expect(bascule).toHaveAttribute('aria-pressed', 'false')
  })

  it('transmet autocomplete tel quel', () => {
    render(<ChampMotDePasse libelle="Mot de passe" autoComplete="current-password" />)
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute(
      'autocomplete',
      'current-password',
    )
  })

  it('relie le message au champ et signale l’erreur', () => {
    render(<ChampMotDePasse libelle="Mot de passe" message="Mot de passe incorrect." erreur />)
    const champ = screen.getByLabelText('Mot de passe')

    expect(champ).toHaveAttribute('aria-invalid', 'true')
    expect(champ).toHaveAccessibleDescription('Mot de passe incorrect.')
  })

  it('désactivé, le bouton œil l’est aussi', () => {
    render(<ChampMotDePasse libelle="Mot de passe" disabled />)
    expect(screen.getByRole('button', { name: 'Afficher le mot de passe' })).toBeDisabled()
  })

  it("n'a aucune violation d'accessibilité", async () => {
    const { container } = render(<ChampMotDePasse libelle="Mot de passe" />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
