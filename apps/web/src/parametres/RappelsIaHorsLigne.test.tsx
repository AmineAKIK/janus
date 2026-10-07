import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { creerRouteur } from '../routes/arbre.tsx'
import { creerContexteTest } from '../routes/contexteTest.tsx'

async function afficher(section: string) {
  const banc = creerContexteTest()
  const routeur = creerRouteur(
    createMemoryHistory({ initialEntries: [`/parametres/${section}`] }),
    banc.contexte,
  )
  await act(async () => {
    render(banc.application(routeur))
    await routeur.load()
  })
  return banc
}

afterEach(() => {
  Reflect.deleteProperty(globalThis.navigator, 'storage')
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Rappels', () => {
  it('désactive les notifications sur la démo et dit pourquoi', async () => {
    await afficher('rappels')
    expect(await screen.findByText(/C’est toi qui décides quand tu travailles/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Activer' })).toBeDisabled()
    expect(screen.getByText('Disponible quand l’appli tourne sur le serveur.')).toBeVisible()
  })

  it('enregistre l’heure du rappel et revient à 19:00', async () => {
    const utilisateur = userEvent.setup()
    const banc = await afficher('rappels')
    const champ = await screen.findByLabelText('Heure du rappel')
    expect(champ).toHaveValue('19:00')

    await utilisateur.clear(champ)
    await utilisateur.type(champ, '08:30')
    await utilisateur.tab()
    await waitFor(() => {
      expect(banc.magasin.lire().reglages.heureRappel).toBe('08:30')
    })
    expect(screen.getByText('Par défaut : 19:00')).toBeVisible()

    await utilisateur.click(
      await screen.findByRole('button', { name: 'Revenir à la valeur par défaut' }),
    )
    await waitFor(() => {
      expect(banc.magasin.lire().reglages.heureRappel).toBe('19:00')
    })
  })

  it('met les rappels en pause jusqu’à une date, puis les reprend', async () => {
    const utilisateur = userEvent.setup()
    const banc = await afficher('rappels')
    const champ = await screen.findByLabelText('Pause jusqu’au')
    expect(screen.getByText('Aucune')).toBeVisible()

    await utilisateur.type(champ, '2026-11-01')
    await waitFor(() => {
      expect(banc.magasin.lire().reglages.rappelsEnPauseJusquAu).toBe('2026-11-01')
    })
    await utilisateur.click(await screen.findByRole('button', { name: 'Reprendre les rappels' }))
    await waitFor(() => {
      expect(banc.magasin.lire().reglages.rappelsEnPauseJusquAu).toBeNull()
    })
  })
})

describe('Correction IA', () => {
  it('montre la dépense, la limite en lecture seule et la confidentialité', async () => {
    await afficher('ia')
    expect(await screen.findByText('Dépense ce mois-ci')).toBeVisible()
    expect(await screen.findByText(/sur 10,00 €/)).toBeVisible()
    expect(screen.getByText('60 appels par heure')).toBeVisible()
    expect(
      screen.getByText(
        'Tes réponses et l’extrait de fiche concerné sont envoyés au service de correction, sans ton nom d’utilisateur.',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('change le plafond en euros, refuse une valeur hors bornes et revient au défaut', async () => {
    const utilisateur = userEvent.setup()
    const banc = await afficher('ia')
    const champ = await screen.findByLabelText('Plafond mensuel (en euros)')
    expect(champ).toHaveValue('10,00')

    await utilisateur.clear(champ)
    await utilisateur.type(champ, '250')
    await utilisateur.tab()
    expect(screen.getByText('Le plafond doit être un nombre entre 0 et 100 €.')).toBeVisible()
    expect(banc.magasin.lire().reglages.plafondIaMillioniemes).toBe(10_000_000)

    await utilisateur.clear(champ)
    await utilisateur.type(champ, '12,5')
    await utilisateur.tab()
    await waitFor(() => {
      expect(banc.magasin.lire().reglages.plafondIaMillioniemes).toBe(12_500_000)
    })
    expect(screen.getByText('Par défaut : 10,00 €')).toBeVisible()
    await utilisateur.click(
      await screen.findByRole('button', { name: 'Revenir à la valeur par défaut' }),
    )
    await waitFor(() => {
      expect(banc.magasin.lire().reglages.plafondIaMillioniemes).toBe(10_000_000)
    })
  })

  it('annonce le plafond atteint', async () => {
    const banc = creerContexteTest()
    banc.magasin.ecrire((etat) => ({
      ...etat,
      interrupteurs: { ...etat.interrupteurs, plafondAtteint: true },
    }))
    const routeur = creerRouteur(
      createMemoryHistory({ initialEntries: ['/parametres/ia'] }),
      banc.contexte,
    )
    await act(async () => {
      render(banc.application(routeur))
      await routeur.load()
    })
    expect(
      await screen.findByText(
        'Plafond atteint : les corrections reprendront le 1er du mois prochain, ou relève le plafond.',
      ),
    ).toBeVisible()
  })
})

describe('Hors ligne', () => {
  it('dit que tout est synchronisé quand la boîte d’envoi est vide', async () => {
    await afficher('hors-ligne')
    expect(await screen.findByText('Tout est synchronisé')).toBeVisible()
    expect(screen.getByText('Non mesurable sur ce navigateur.')).toBeVisible()
  })

  it('compte les réponses en attente et mesure l’espace de l’appareil', async () => {
    Object.defineProperty(globalThis.navigator, 'storage', {
      value: { estimate: () => Promise.resolve({ usage: 3_500_000 }) },
      configurable: true,
    })
    const banc = creerContexteTest()
    vi.spyOn(banc.boite, 'entrees').mockResolvedValue([
      { id: 'a', route: 'POST /evenements', corps: {}, cree_le: '', ordre: 1, essais: 0 },
      { id: 'b', route: 'POST /evenements', corps: {}, cree_le: '', ordre: 2, essais: 0 },
    ])
    const routeur = creerRouteur(
      createMemoryHistory({ initialEntries: ['/parametres/hors-ligne'] }),
      banc.contexte,
    )
    await act(async () => {
      render(banc.application(routeur))
      await routeur.load()
    })
    expect(await screen.findByText('2 réponses en attente')).toBeVisible()
    expect(await screen.findByText('3,5 Mo sur cet appareil')).toBeVisible()
  })
})
