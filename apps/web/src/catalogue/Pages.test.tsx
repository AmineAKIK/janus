import { ROUTES } from '@janus/contrats'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { creerRouteur } from '../routes/arbre.tsx'
import { creerContexteTest } from '../routes/contexteTest.tsx'

async function afficher(
  chemin: string,
  avant?: (banc: ReturnType<typeof creerContexteTest>) => void,
) {
  const banc = creerContexteTest()
  avant?.(banc)
  const routeur = creerRouteur(createMemoryHistory({ initialEntries: [chemin] }), banc.contexte)
  await act(async () => {
    render(banc.application(routeur))
    await routeur.load()
  })
  return { ...banc, routeur }
}

function deuxFormations({ magasin }: ReturnType<typeof creerContexteTest>) {
  magasin.ecrire((etat) => ({
    ...etat,
    interrupteurs: { ...etat.interrupteurs, deuxFormations: true },
  }))
}

describe('Formations', () => {
  it('une formation : titre, résumé, compteur tiré des statuts calculés et légende', async () => {
    await afficher('/formations')

    expect(await screen.findByRole('heading', { level: 1, name: 'Formations' })).toBeVisible()
    expect(screen.getByText('Retrouve tes parcours et l’état réel de tes acquis.')).toBeVisible()
    expect(
      await screen.findByRole('heading', { name: 'DWWM · Développeur web et web mobile' }),
    ).toBeVisible()
    expect(screen.getByText('4 modules · 20 blocs dans le module en cours')).toBeVisible()
    // La graine : B01 et B06 sont acquis, B02 et B07 seulement provisoirement.
    expect(screen.getByText('2 blocs acquis sur 20')).toBeVisible()
    const legende = screen.getByRole('list', { name: 'Légende des statuts' })
    expect(within(legende).getAllByRole('listitem')).toHaveLength(7)
  })

  it('reste affiché avec une seule formation, sans redirection', async () => {
    const { routeur } = await afficher('/formations')

    await screen.findByText('2 blocs acquis sur 20')
    expect(routeur.state.location.pathname).toBe('/formations')
  })

  it('deux formations : la seconde, sans module importé, est « non commencée »', async () => {
    await afficher('/formations', deuxFormations)

    expect(
      await screen.findByRole('heading', { name: 'CDA · Concepteur développeur d’applications' }),
    ).toBeVisible()
    expect(screen.getByText('8 modules')).toBeVisible()
    expect(screen.getByText('Formation non commencée · contenu prêt à être importé')).toBeVisible()
    expect(screen.getAllByRole('article')).toHaveLength(2)
  })

  it('chargement puis erreur avec un bouton Réessayer', async () => {
    let panne: MockInstance | undefined
    await afficher('/formations', ({ transport }) => {
      const reel = transport.appeler.bind(transport)
      panne = vi
        .spyOn(transport, 'appeler')
        .mockImplementation((route, ...reste) =>
          route === ROUTES['GET /formations']
            ? Promise.reject(new Error('panne'))
            : reel(route, ...reste),
        )
    })
    const utilisateur = userEvent.setup()

    expect(await screen.findByRole('alert', {}, { timeout: 4000 })).toHaveTextContent(
      'Impossible de charger cet écran.',
    )
    panne?.mockRestore()
    await utilisateur.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText('2 blocs acquis sur 20')).toBeVisible()
  })

  it('ouvre les modules de la formation', async () => {
    const utilisateur = userEvent.setup()
    const { routeur } = await afficher('/formations')

    await utilisateur.click(await screen.findByRole('link', { name: /DWWM · Développeur/ }))

    await waitFor(() => {
      expect(routeur.state.location.pathname).toBe('/formations/DWWM')
    })
  })
})

describe('Modules', () => {
  it('fil d’Ariane, titre, description et une ligne par module dans l’ordre', async () => {
    await afficher('/formations/DWWM')

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'DWWM · Développeur web et web mobile',
      }),
    ).toBeVisible()
    const fil = screen.getByRole('navigation', { name: 'Fil d’Ariane' })
    expect(within(fil).getByRole('link', { name: 'Formations' })).toHaveAttribute(
      'href',
      '/formations',
    )
    expect(within(fil).getByText('DWWM')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Une formation d’exemple pour montrer l’appli.')).toBeVisible()

    const lignes = within(screen.getByRole('main')).getAllByRole('listitem')
    await screen.findByRole('link', { name: /Module 1/ })
    expect(lignes.map((ligne) => ligne.textContent)).toEqual([
      expect.stringContaining('Module 1 · Environnement numérique et poste de travail'),
      expect.stringContaining('Module 2 · Réaliser une interface web statique'),
      expect.stringContaining('Module 3 · Réaliser une interface web dynamique'),
      expect.stringContaining('Module 4 · Créer une base de données'),
    ])
  })

  it('module importé : résumé des compteurs, lien vers ses blocs', async () => {
    await afficher('/formations/DWWM')

    const lien = await screen.findByRole('link', { name: /Module 1/ })
    expect(lien).toHaveAttribute('href', '/modules/M1')
    expect(lien).toHaveTextContent('20 blocs · 5 en cours · 2 acquis')
  })

  it('module non importé : « Pas encore importé », pas de lien', async () => {
    await afficher('/formations/DWWM')

    await screen.findByRole('link', { name: /Module 1/ })
    expect(screen.queryByRole('link', { name: /Module 2/ })).not.toBeInTheDocument()
    expect(screen.getAllByText('Pas encore importé')).toHaveLength(3)
  })

  it('une formation inconnue affiche une erreur avec Réessayer', async () => {
    await afficher('/formations/INCONNUE')

    expect(await screen.findByRole('alert')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeVisible()
  })
})
