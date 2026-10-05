import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from '../../tests/axe.ts'
import { describe, expect, it, vi } from 'vitest'
import { ZoneDeTexte } from './ZoneDeTexte.tsx'

describe('ZoneDeTexte', () => {
  it('lie le libellé à la zone', async () => {
    render(<ZoneDeTexte libelle="Réponse libre" />)
    const zone = screen.getByLabelText('Réponse libre')

    await userEvent.setup().type(zone, 'Bonjour')

    expect(zone).toHaveValue('Bonjour')
  })

  it('appelle onPaste au collage', async () => {
    const auCollage = vi.fn()
    const utilisateur = userEvent.setup()
    render(<ZoneDeTexte libelle="Réponse libre" onPaste={auCollage} />)

    await utilisateur.click(screen.getByLabelText('Réponse libre'))
    await utilisateur.paste('texte collé')

    expect(auCollage).toHaveBeenCalledTimes(1)
  })

  it('appelle onChange et transmet la valeur', async () => {
    const auChangement = vi.fn()
    render(<ZoneDeTexte libelle="Réponse libre" onChange={auChangement} />)

    await userEvent.setup().type(screen.getByLabelText('Réponse libre'), 'ab')

    expect(auChangement).toHaveBeenCalledTimes(2)
  })

  it('affiche le compteur et passe en erreur au-delà de la limite', async () => {
    render(<ZoneDeTexte libelle="Réponse libre" maxCaracteres={5} />)
    const zone = screen.getByLabelText('Réponse libre')

    expect(screen.getByText('0 / 5')).toBeInTheDocument()

    await userEvent.setup().type(zone, 'abcdefg')

    expect(screen.getByText('7 / 5')).toBeInTheDocument()
    expect(zone).toHaveAccessibleDescription('7 / 5')
  })

  it("n'affiche pas de compteur sans maxCaracteres", () => {
    render(<ZoneDeTexte libelle="Réponse libre" />)
    expect(screen.queryByText(/\//)).not.toBeInTheDocument()
  })

  it('pose la hauteur maximale selon lignesMax (12 par défaut)', () => {
    const { rerender } = render(<ZoneDeTexte libelle="Réponse libre" />)
    expect(screen.getByLabelText('Réponse libre').style.maxHeight).toContain('12 *')
    rerender(<ZoneDeTexte libelle="Réponse libre" lignesMax={5} />)
    expect(screen.getByLabelText('Réponse libre').style.maxHeight).toContain('5 *')
  })

  it('en erreur : aria-invalid et message relié', () => {
    render(<ZoneDeTexte libelle="Réponse libre" message="Ce champ est obligatoire." erreur />)
    const zone = screen.getByLabelText('Réponse libre')

    expect(zone).toHaveAttribute('aria-invalid', 'true')
    expect(zone).toHaveAccessibleDescription('Ce champ est obligatoire.')
  })

  it("n'a aucune violation d'accessibilité", async () => {
    const { container } = render(
      <ZoneDeTexte libelle="Réponse libre" message="Aide" maxCaracteres={200} />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
