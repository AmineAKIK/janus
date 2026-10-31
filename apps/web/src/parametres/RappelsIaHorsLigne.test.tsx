import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { creerRouteur } from '../routes/arbre.tsx'
import type { EtatInstallation, Installation } from '../pwa/installation.ts'
import { ContexteInstallation } from '../pwa/useInstallation.ts'
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
  vi.useRealTimers()
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
    const champ = await screen.findByRole('button', { name: /Heure du rappel/ })
    expect(champ).toHaveTextContent('19:00')

    await utilisateur.click(champ)
    await utilisateur.click(
      within(screen.getByRole('listbox', { name: 'Heures' })).getByRole('option', { name: '08' }),
    )
    await utilisateur.click(
      within(screen.getByRole('listbox', { name: 'Minutes' })).getByRole('option', { name: '30' }),
    )
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
    // Le calendrier s'ouvre sur le jour courant à Paris : le temps est figé en octobre 2026, pour
    // que « Mois suivant » mène toujours à novembre.
    vi.useFakeTimers({ toFake: ['Date'], now: Date.parse('2026-10-15T10:00:00Z') })
    const utilisateur = userEvent.setup()
    const banc = await afficher('rappels')
    const champ = await screen.findByRole('button', { name: /Pause jusqu’au/ })
    expect(screen.getByText('Aucune')).toBeVisible()

    await utilisateur.click(champ)
    await utilisateur.click(screen.getByRole('button', { name: 'Mois suivant' }))
    await utilisateur.click(
      screen.getByRole('button', { name: /^1er novembre 2026$|^1 novembre 2026$/ }),
    )
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

  describe('installation', () => {
    async function afficherAvec(
      etat: EtatInstallation,
      installer = vi.fn(() => Promise.resolve(true)),
    ) {
      const installation: Installation = {
        demarrer: () => () => undefined,
        etat: () => etat,
        installer,
        abonner: () => () => undefined,
      }
      const banc = creerContexteTest()
      const routeur = creerRouteur(
        createMemoryHistory({ initialEntries: ['/parametres/hors-ligne'] }),
        banc.contexte,
      )
      await act(async () => {
        render(
          <ContexteInstallation value={installation}>
            {banc.application(routeur)}
          </ContexteInstallation>,
        )
        await routeur.load()
      })
      return installer
    }

    it('propose d’installer l’appli quand le navigateur le permet', async () => {
      const utilisateur = userEvent.setup()
      const installer = await afficherAvec('installable')
      expect(await screen.findByText('Installer Janus')).toBeVisible()
      await utilisateur.click(screen.getByRole('button', { name: 'Installer' }))
      expect(installer).toHaveBeenCalledOnce()
    })

    it('dit que l’appli est installée, ou montre la marche à suivre sur iPhone', async () => {
      await afficherAvec('installee')
      expect(await screen.findByText('Installée sur cet appareil')).toBeVisible()
    })

    it('indique la marche à suivre quand l’installation est manuelle', async () => {
      await afficherAvec('manuelle')
      expect(await screen.findByText(/Partager, puis Sur l’écran d’accueil/)).toBeVisible()
    })

    it('ne montre rien quand le navigateur ne sait pas installer', async () => {
      await afficherAvec('indisponible')
      await screen.findByText('Tout est synchronisé')
      expect(screen.queryByText('Installer Janus')).toBeNull()
    })
  })
})
