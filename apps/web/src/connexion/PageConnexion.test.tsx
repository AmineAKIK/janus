import { ErreurReseau } from '@janus/contrats'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { creerRouteur } from '../routes/arbre.tsx'
import { creerContexteTest } from '../routes/contexteTest.tsx'

async function afficher(chemin = '/connexion') {
  const banc = creerContexteTest({ connecte: false })
  const { application } = banc
  const routeur = creerRouteur(createMemoryHistory({ initialEntries: [chemin] }), banc.contexte)
  await act(async () => {
    render(application(routeur))
    await routeur.load()
  })
  return {
    ...banc,
    routeur,
    utilisateur: userEvent.setup({
      advanceTimers: (ms) => {
        if (vi.isFakeTimers()) vi.advanceTimersByTime(ms)
      },
    }),
  }
}

const champ = (nom: string) => screen.getByLabelText(nom)
const bouton = () => screen.getByRole('button', { name: /Se connecter|Réessayer dans/ })

async function saisir(
  utilisateur: Awaited<ReturnType<typeof afficher>>['utilisateur'],
  motDePasse: string,
  identifiant = 'amine',
) {
  await utilisateur.type(champ('Nom d’utilisateur'), identifiant)
  await utilisateur.type(champ('Mot de passe'), motDePasse)
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('écran de connexion', () => {
  it('Vide : titre, champs pour le gestionnaire de mots de passe, case et bouton', async () => {
    await afficher()

    expect(screen.getByRole('heading', { level: 1, name: 'Atelier' })).toBeInTheDocument()
    expect(screen.getByText('Apprendre pour de vrai, à ton rythme.')).toBeInTheDocument()
    expect(champ('Nom d’utilisateur')).toHaveAttribute('autocomplete', 'username')
    expect(champ('Mot de passe')).toHaveAttribute('autocomplete', 'current-password')
    expect(
      screen.getByRole('checkbox', { name: 'Rester connecté sur cet appareil' }),
    ).not.toBeChecked()
    expect(bouton()).toBeEnabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('affiche les identifiants de la démo', async () => {
    await afficher()

    expect(screen.getByRole('status')).toHaveTextContent('amine')
    expect(screen.getByRole('status')).toHaveTextContent('demo-janus')
  })

  it('Rempli puis envoi par Entrée : mène à Aujourd’hui', async () => {
    const { utilisateur, routeur } = await afficher()

    await saisir(utilisateur, 'demo-janus{Enter}')

    await waitFor(() => {
      expect(routeur.state.location.pathname).toBe('/')
    })
  })

  it('Erreur : même message, mot de passe vidé et refocalisé', async () => {
    const { utilisateur } = await afficher()

    await saisir(utilisateur, 'faux{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Nom d’utilisateur ou mot de passe incorrect.',
    )
    expect(champ('Mot de passe')).toHaveValue('')
    expect(champ('Mot de passe')).toHaveFocus()
    expect(champ('Mot de passe')).toHaveAttribute('aria-invalid', 'true')
    expect(bouton()).toBeEnabled()
  })

  it('refuse une saisie vide avec le même message, sans appeler le serveur', async () => {
    const { utilisateur, transport } = await afficher()
    const appel = vi.spyOn(transport, 'appeler')

    await utilisateur.click(bouton())

    expect(await screen.findByRole('alert')).toHaveTextContent('incorrect')
    expect(appel).not.toHaveBeenCalled()
  })

  it('Chargement : champs désactivés et bouton en chargement', async () => {
    const { utilisateur, transport } = await afficher()
    vi.spyOn(transport, 'appeler').mockReturnValue(new Promise(() => undefined))

    await saisir(utilisateur, 'demo-janus{Enter}')

    expect(champ('Nom d’utilisateur')).toBeDisabled()
    expect(champ('Mot de passe')).toBeDisabled()
    expect(screen.getByRole('checkbox')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Se connecter' })).toHaveAttribute(
      'aria-busy',
      'true',
    )
  })

  it('Trop d’essais : bouton désactivé avec un compte à rebours, puis réactivé', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { utilisateur } = await afficher()
    for (let i = 0; i < 5; i += 1) {
      await utilisateur.clear(champ('Nom d’utilisateur'))
      await saisir(utilisateur, 'faux{Enter}')
      await screen.findByRole('alert')
    }

    expect(screen.getByRole('alert')).toHaveTextContent('Trop d’essais. Réessaie dans 1 minute.')
    expect(bouton()).toBeDisabled()
    expect(bouton()).toHaveTextContent(/^Réessayer dans 1:00$|^Réessayer dans 0:5\d$/)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(bouton()).toHaveTextContent(/Réessayer dans 0:(4\d|5\d)/)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(bouton()).toBeEnabled()
    expect(bouton()).toHaveTextContent('Se connecter')
  })

  it('Hors connexion : bandeau, bouton désactivé, nouvel essai au retour du réseau', async () => {
    const { utilisateur, transport } = await afficher()
    const appel = vi.spyOn(transport, 'appeler').mockRejectedValueOnce(new ErreurReseau())
    await saisir(utilisateur, 'demo-janus{Enter}')

    expect(await screen.findByText(/Pas de connexion internet/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeDisabled()
    expect(champ('Nom d’utilisateur')).toHaveValue('amine')

    appel.mockRestore()
    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.queryByText(/Pas de connexion internet/)).not.toBeInTheDocument()
    })
  })

  it('détecte l’absence de réseau avec navigator.onLine', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

    await afficher()

    expect(screen.getByText(/Pas de connexion internet/)).toBeInTheDocument()
  })

  it('revient à la page demandée après la connexion', async () => {
    const { utilisateur, routeur } = await afficher('/journal?bloc=B04')

    expect(routeur.state.location.pathname).toBe('/connexion')
    await saisir(utilisateur, 'demo-janus{Enter}')

    await waitFor(() => {
      expect(routeur.state.location.pathname).toBe('/journal')
    })
    expect(routeur.state.location.search).toEqual({ bloc: 'B04' })
  })
})
