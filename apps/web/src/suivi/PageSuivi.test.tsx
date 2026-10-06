import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { creerRouteur } from '../routes/arbre.tsx'
import { creerContexteTest } from '../routes/contexteTest.tsx'
import { rangees } from './CarteDuModule.tsx'
import { euros, texteBudget } from './textes.ts'

async function afficher() {
  const banc = creerContexteTest()
  const routeur = creerRouteur(
    createMemoryHistory({ initialEntries: ['/tableau-de-bord'] }),
    banc.contexte,
  )
  await act(async () => {
    render(banc.application(routeur))
    await routeur.load()
  })
  await screen.findByRole('heading', { level: 2, name: 'Carte du module' })
  return banc
}

describe('Suivi', () => {
  it('formate les euros et le budget', () => {
    expect(euros(1_250_000)).toBe('1,25 €')
    expect(texteBudget(500_000, 5_000_000)).toBe('0,50 € sur 5,00 € ce mois')
  })

  it('range les blocs par partie sans changer l’ordre', () => {
    const bloc = (code: string, partie: string) =>
      ({ bloc: code, partie }) as Parameters<typeof rangees>[0][number]
    expect(
      rangees([bloc('B01', 'A'), bloc('B02', 'A'), bloc('B03', 'B')]).map((l) =>
        l.map(({ bloc: b }) => b),
      ),
    ).toEqual([['B01', 'B02'], ['B03']])
  })

  it('affiche la carte du module, la légende et les liens vers les blocs', async () => {
    await afficher()

    expect(screen.getByRole('heading', { level: 1, name: 'Suivi' })).toBeVisible()
    expect(screen.getByText(/blocs · les traits indiquent les prérequis/)).toBeVisible()
    expect(screen.getByRole('list', { name: 'Légende des statuts' })).toBeVisible()
    expect(screen.getByRole('radio', { name: '30 jours' })).toBeChecked()
    expect(screen.getAllByRole('link', { name: 'Journal' })[0]).toBeVisible()
    expect(
      screen
        .getAllByRole('link')
        .filter((lien) => /#\/blocs\/B\d+/.test(lien.getAttribute('href') ?? '')).length,
    ).toBeGreaterThanOrEqual(20)
  })

  it('montre À faire, les erreurs, les décisions et le coût IA', async () => {
    await afficher()

    expect(screen.getByRole('heading', { level: 2, name: 'À faire' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Tout voir dans Aujourd’hui' })).toBeVisible()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Erreurs critiques récurrentes' }),
    ).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: 'Statuts forcés et accès' })).toBeVisible()
    const cout = screen.getByRole('region', { name: 'Coût IA' })
    expect(
      within(cout).getByRole('progressbar', { name: 'Budget mensuel de correction' }),
    ).toBeVisible()
  })

  it('force un statut avec une raison d’au moins 10 caractères, puis revient au statut calculé', async () => {
    await afficher()
    const utilisateur = userEvent.setup()

    await utilisateur.click(screen.getByRole('button', { name: 'Forcer un statut' }))
    const dialogue = screen.getByRole('dialog', { name: 'Forcer un statut' })
    const valider = within(dialogue).getByRole('button', { name: 'Forcer le statut' })
    expect(valider).toBeDisabled()

    await utilisateur.type(within(dialogue).getByLabelText('Raison'), 'court')
    expect(valider).toBeDisabled()
    await utilisateur.type(within(dialogue).getByLabelText('Raison'), ' mais maintenant assez long')
    await utilisateur.click(valider)

    expect(await screen.findByText(/Raison : court mais maintenant assez long/)).toBeVisible()
    await utilisateur.click(screen.getByRole('button', { name: /Revenir au statut calculé/ }))
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Revenir au statut calculé/ })).toBeNull()
    })
  })
})
