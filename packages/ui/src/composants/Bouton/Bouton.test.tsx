import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from '../../tests/axe.ts'
import { describe, expect, it, vi } from 'vitest'
import { Bouton, type VarianteBouton } from './Bouton.tsx'

const VARIANTES: readonly VarianteBouton[] = ['principal', 'secondaire', 'texte', 'danger']

describe('Bouton', () => {
  it.each(VARIANTES)('affiche la variante %s avec son libellé', (variante) => {
    render(<Bouton variante={variante}>Se connecter</Bouton>)
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument()
  })

  it('est de type button par défaut et transmet le type submit', () => {
    const { rerender } = render(<Bouton>Valider</Bouton>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
    rerender(<Bouton type="submit">Valider</Bouton>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
  })

  it('appelle onClick au clic et au clavier', async () => {
    const auClic = vi.fn()
    const utilisateur = userEvent.setup()
    render(<Bouton onClick={auClic}>Valider</Bouton>)

    await utilisateur.click(screen.getByRole('button'))
    await utilisateur.keyboard('{Enter}')
    await utilisateur.keyboard(' ')

    expect(auClic).toHaveBeenCalledTimes(3)
  })

  it("désactivé, il n'appelle pas onClick", async () => {
    const auClic = vi.fn()
    render(
      <Bouton disabled onClick={auClic}>
        Valider
      </Bouton>,
    )

    await userEvent.setup().click(screen.getByRole('button'))

    expect(screen.getByRole('button')).toBeDisabled()
    expect(auClic).not.toHaveBeenCalled()
  })

  it('en chargement : libellé conservé, aria-busy, désactivé, pas de clic', async () => {
    const auClic = vi.fn()
    render(
      <Bouton chargement onClick={auClic}>
        Enregistrement
      </Bouton>,
    )
    const bouton = screen.getByRole('button', { name: 'Enregistrement' })

    await userEvent.setup().click(bouton)

    expect(bouton).toHaveAttribute('aria-busy', 'true')
    expect(bouton).toBeDisabled()
    expect(auClic).not.toHaveBeenCalled()
  })

  it("affiche l'icône sauf en chargement", () => {
    const { rerender } = render(<Bouton icone={<svg data-testid="icone" />}>Valider</Bouton>)
    expect(screen.getByTestId('icone')).toBeInTheDocument()
    rerender(
      <Bouton chargement icone={<svg data-testid="icone" />}>
        Valider
      </Bouton>,
    )
    expect(screen.queryByTestId('icone')).not.toBeInTheDocument()
  })

  it.each(VARIANTES)("n'a aucune violation d'accessibilité en %s", async (variante) => {
    const { container } = render(<Bouton variante={variante}>Se connecter</Bouton>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
