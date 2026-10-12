import { nomRoute, Reglages, ROUTES } from '@janus/contrats'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BandeauHorsConnexion, texteInstant } from './BandeauHorsConnexion.tsx'

afterEach(() => {
  vi.restoreAllMocks()
})

function afficher(client = new QueryClient()) {
  render(
    <QueryClientProvider client={client}>
      <BandeauHorsConnexion />
    </QueryClientProvider>,
  )
  return client
}

describe('bandeau hors connexion', () => {
  it('ne montre rien en ligne', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    afficher()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('dit de quand datent les données montrées', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const client = new QueryClient()
    const instant = Date.parse('2026-10-12T14:03:00')
    client.setQueryData([nomRoute(ROUTES['GET /reglages']), {}], Reglages.parse({}), {
      updatedAt: instant,
    })
    afficher(client)

    expect(screen.getByRole('status')).toHaveTextContent(
      `Hors connexion. Données du ${texteInstant(instant)}. Les réponses seront envoyées dès le retour du réseau.`,
    )
    expect(texteInstant(instant)).toMatch(/^12 oct\.? à 14:03$/)
  })

  it('ne parle pas de données quand rien n’a été lu', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    afficher()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Hors connexion. Les réponses seront envoyées dès le retour du réseau.',
    )
  })

  it('apparaît et disparaît avec le réseau', () => {
    const enLigne = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    afficher()
    expect(screen.queryByRole('status')).toBeNull()

    enLigne.mockReturnValue(false)
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByRole('status')).toBeVisible()

    enLigne.mockReturnValue(true)
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.queryByRole('status')).toBeNull()
  })
})
