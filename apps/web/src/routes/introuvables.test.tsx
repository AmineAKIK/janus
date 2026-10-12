import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { creerRouteur } from './arbre.tsx'
import { creerContexteTest } from './contexteTest.tsx'

async function ouvrir(chemin: string) {
  const banc = creerContexteTest()
  const routeur = creerRouteur(createMemoryHistory({ initialEntries: [chemin] }), banc.contexte)
  await act(async () => {
    render(banc.application(routeur))
    await routeur.load()
  })
}

describe('une adresse que le serveur ne connaît pas', () => {
  it.each([
    ['/blocs/ZZ99', 'Ce bloc n’existe pas.'],
    ['/modules/Z9', 'Cette page n’existe pas ou plus.'],
    ['/formations/XXX', 'Cette page n’existe pas ou plus.'],
  ])('%s : le dit et propose de revenir, sans « Réessayer »', async (chemin, message) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await ouvrir(chemin)

    expect(await screen.findByText(message)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Retour aux formations' })).toBeVisible()
  })
})
