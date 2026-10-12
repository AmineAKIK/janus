import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { axe } from '../../tests/axe.ts'
import { ChampDate } from './ChampDate.tsx'

const SANS_REGION = { rules: { region: { enabled: false } } }

function afficher(valeur = '', auChangement = vi.fn()) {
  render(
    <ChampDate
      libelle="Pause jusqu’au"
      valeur={valeur}
      onChange={auChangement}
      aujourdhui="2026-10-12"
    />,
  )
  return { auChangement, bouton: screen.getByRole('button', { name: /Pause jusqu’au/ }) }
}

describe('ChampDate', () => {
  it('écrit la date choisie en toutes lettres, ou invite à en choisir une', () => {
    const { bouton } = afficher('2026-10-12')
    expect(bouton).toHaveTextContent('12 octobre 2026')
  })

  it('sans date, le bouton le dit', () => {
    const { bouton } = afficher('')
    expect(bouton).toHaveTextContent('Choisir une date')
  })

  it('ouvre le mois du jour, marque aujourd’hui et choisit un jour', async () => {
    const utilisateur = userEvent.setup()
    const { auChangement, bouton } = afficher()

    await utilisateur.click(bouton)
    const calendrier = screen.getByRole('dialog', { name: 'Pause jusqu’au' })

    expect(within(calendrier).getByText('octobre 2026')).toBeVisible()
    expect(within(calendrier).getByRole('button', { name: '12 octobre 2026' })).toHaveAttribute(
      'aria-current',
      'date',
    )
    await utilisateur.click(within(calendrier).getByRole('button', { name: '20 octobre 2026' }))

    expect(auChangement).toHaveBeenCalledWith('2026-10-20')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('change de mois avec les boutons et avec les touches', async () => {
    const utilisateur = userEvent.setup()
    const { bouton } = afficher('2026-10-12')

    await utilisateur.click(bouton)
    await utilisateur.click(screen.getByRole('button', { name: 'Mois suivant' }))
    expect(screen.getByText('novembre 2026')).toBeVisible()

    screen.getByRole('button', { name: '12 novembre 2026' }).focus()
    await utilisateur.keyboard('{PageUp}')
    expect(screen.getByText('octobre 2026')).toBeVisible()
  })

  it('se pilote aux flèches et à Entrée, Échap ferme et rend le focus au bouton', async () => {
    const utilisateur = userEvent.setup()
    const { auChangement, bouton } = afficher('2026-10-12')

    await utilisateur.click(bouton)
    screen.getByRole('button', { name: '12 octobre 2026' }).focus()
    await utilisateur.keyboard('{ArrowRight}{ArrowDown}')
    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: '20 octobre 2026' })).toHaveFocus()
    })
    await utilisateur.keyboard('{Enter}')
    expect(auChangement).toHaveBeenCalledWith('2026-10-20')

    await utilisateur.click(bouton)
    await utilisateur.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(bouton).toHaveFocus()
  })

  it('efface la date, et « Aujourd’hui » choisit le jour courant', async () => {
    const utilisateur = userEvent.setup()
    const { auChangement, bouton } = afficher('2026-10-20')

    await utilisateur.click(bouton)
    await utilisateur.click(screen.getByRole('button', { name: 'Aujourd’hui' }))
    expect(auChangement).toHaveBeenLastCalledWith('2026-10-12')

    await utilisateur.click(bouton)
    await utilisateur.click(screen.getByRole('button', { name: 'Effacer' }))
    expect(auChangement).toHaveBeenLastCalledWith('')
  })

  it('n’a aucune violation d’accessibilité, ouvert', async () => {
    const { bouton } = afficher('2026-10-12')

    await userEvent.setup().click(bouton)

    expect(await axe(document.body, SANS_REGION)).toHaveNoViolations()
  })
})
