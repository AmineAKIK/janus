import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { axe } from '../../tests/axe.ts'
import { ChampHeure } from './ChampHeure.tsx'

const SANS_REGION = { rules: { region: { enabled: false } } }

function afficher(auChangement = vi.fn()) {
  render(<ChampHeure libelle="Heure du rappel" valeur="19:00" onChange={auChangement} />)
  return { auChangement, bouton: screen.getByRole('button', { name: /Heure du rappel/ }) }
}

describe('ChampHeure', () => {
  it('montre l’heure courante', () => {
    const { bouton } = afficher()
    expect(bouton).toHaveTextContent('19:00')
  })

  it('ouvre deux colonnes, marque l’heure courante et rend le choix à la fermeture', async () => {
    const utilisateur = userEvent.setup()
    const { auChangement, bouton } = afficher()

    await utilisateur.click(bouton)
    const heures = screen.getByRole('listbox', { name: 'Heures' })
    const minutes = screen.getByRole('listbox', { name: 'Minutes' })
    expect(within(heures).getByRole('option', { name: '19' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    await utilisateur.click(within(heures).getByRole('option', { name: '08' }))
    expect(auChangement).not.toHaveBeenCalled()
    await utilisateur.click(within(minutes).getByRole('option', { name: '30' }))

    expect(auChangement).toHaveBeenCalledWith('08:30')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Échap abandonne le choix', async () => {
    const utilisateur = userEvent.setup()
    const { auChangement, bouton } = afficher()

    await utilisateur.click(bouton)
    await utilisateur.click(
      within(screen.getByRole('listbox', { name: 'Heures' })).getByRole('option', { name: '08' }),
    )
    await utilisateur.keyboard('{Escape}')

    expect(auChangement).not.toHaveBeenCalled()
    expect(bouton).toHaveFocus()
  })

  it('se pilote aux flèches : haut et bas changent la valeur, Entrée valide', async () => {
    const utilisateur = userEvent.setup()
    const { auChangement, bouton } = afficher()

    await utilisateur.click(bouton)
    await vi.waitFor(() => {
      expect(screen.getByRole('option', { name: '19', selected: true })).toHaveFocus()
    })
    await utilisateur.keyboard('{ArrowDown}{Enter}')

    expect(auChangement).toHaveBeenCalledWith('20:00')
  })

  it('n’a aucune violation d’accessibilité, ouvert', async () => {
    const { bouton } = afficher()

    await userEvent.setup().click(bouton)

    expect(await axe(document.body, SANS_REGION)).toHaveNoViolations()
  })
})
