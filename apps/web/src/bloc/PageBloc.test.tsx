import { EXEMPLES_PAGE } from '@janus/contrats'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { creerRouteur } from '../routes/arbre.tsx'
import { creerContexteTest } from '../routes/contexteTest.tsx'
import { marquerOuvert } from './ouvertures.ts'

async function afficher(options: { stockageIndisponible?: boolean; bloc?: string } = {}) {
  const { bloc = 'B03', ...reglages } = options
  const banc = creerContexteTest(reglages)
  const routeur = creerRouteur(
    createMemoryHistory({ initialEntries: [`/blocs/${bloc}`] }),
    banc.contexte,
  )
  await act(async () => {
    render(banc.application(routeur))
    await routeur.load()
  })
  const iframe = await screen.findByTitle(new RegExp(`^Fiche du bloc ${bloc}`))
  if (!(iframe instanceof HTMLIFrameElement) || iframe.contentWindow === null) {
    throw new Error('iframe absente')
  }
  const fenetre = iframe.contentWindow
  vi.spyOn(fenetre, 'postMessage').mockImplementation(() => undefined)
  const envoyer = async (data: unknown) => {
    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', { data, source: fenetre }))
      await Promise.resolve()
    })
  }
  const coupure = (actif: boolean) => {
    banc.magasin.ecrire((etat) => ({
      ...etat,
      interrupteurs: { ...etat.interrupteurs, horsConnexion: actif },
    }))
  }
  return { ...banc, routeur, envoyer, coupure }
}

let compteur = 0
const etape = (etapeId: string) => ({
  ...EXEMPLES_PAGE['etape.vue'],
  id: `0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f${(0x1000 + compteur++).toString(16)}`,
  bloc: 'B03',
  version: 1,
  etape: etapeId,
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('indicateur d’enregistrement', () => {
  it('affiche « ✓ Enregistré » quand rien n’attend', async () => {
    await afficher()

    expect(screen.getByText('✓ Enregistré')).toBeVisible()
  })

  it('hors connexion : « 3 réponses gardées » et l’encart, puis « ✓ Enregistré » au retour', async () => {
    const { envoyer, coupure } = await afficher()
    coupure(true)

    for (const nom of ['ET2', 'ET3', 'ET4']) await envoyer(etape(nom))

    expect(await screen.findByText('En attente de réseau · 3 réponses gardées')).toBeVisible()
    expect(screen.getByText('Envoyée dès le retour du réseau.')).toBeVisible()

    coupure(false)
    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.getByText('✓ Enregistré')).toBeVisible()
    })
    expect(screen.queryByText('Envoyée dès le retour du réseau.')).not.toBeInTheDocument()
  })

  it('accorde « 1 réponse gardée »', async () => {
    const { envoyer, coupure } = await afficher()
    coupure(true)

    await envoyer(etape('ET2'))

    expect(await screen.findByText('En attente de réseau · 1 réponse gardée')).toBeVisible()
  })

  it('est annoncé par une région aria-live polie', async () => {
    await afficher()

    expect(screen.getByText('✓ Enregistré')).toHaveAttribute('aria-live', 'polite')
  })
})

describe('conflit d’état', () => {
  it('n’écrase pas, prévient, et « Recharger la fiche » relit le bloc', async () => {
    const utilisateur = userEvent.setup()
    const { envoyer, magasin } = await afficher()
    // Un autre appareil a sauvegardé l'état entre-temps.
    magasin.ecrire((etat) => ({ ...etat, etatsPage: { ...etat.etatsPage, B03: { etape: 'ET9' } } }))

    await envoyer({
      ...EXEMPLES_PAGE['etat.sauver'],
      id: '0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f2001',
      bloc: 'B03',
      version: 1,
      etat: { etape: 'ET2' },
    })

    expect(await screen.findByText('Ce bloc a été modifié sur un autre appareil.')).toBeVisible()
    expect(magasin.lire().etatsPage['B03']).toEqual({ etape: 'ET9' })

    await utilisateur.click(screen.getByRole('button', { name: 'Recharger la fiche' }))

    await waitFor(() => {
      expect(
        screen.queryByText('Ce bloc a été modifié sur un autre appareil.'),
      ).not.toBeInTheDocument()
    })
  })
})

describe('retour ciblé', () => {
  it('« à reprendre » : l’étape liée à l’erreur ouverte et la restitution rouverte passent à « ↺ »', async () => {
    // B04 a déjà été ouvert avant ses prérequis : la raison est donnée, la page ne la redemande pas.
    marquerOuvert('B04')
    await afficher({ bloc: 'B04' })

    const fil = screen.getByRole('navigation', { name: 'Étapes de la fiche' })
    expect(within(fil).getByRole('button', { name: 'Explication' }).textContent).toBe(
      '↺ Explication',
    )
    expect(within(fil).getByRole('button', { name: 'Restitution' }).textContent).toBe(
      '↺ Restitution',
    )
    expect(within(fil).getByRole('button', { name: 'Pratique guidée' }).textContent).not.toContain(
      '↺',
    )
  })

  it('au bilan, ce qui reste se lit avec les noms de la fiche, pas ses identifiants', async () => {
    marquerOuvert('B04')
    const { envoyer } = await afficher({ bloc: 'B04' })

    await envoyer({ ...etape('ET9'), bloc: 'B04' })

    const pourPasser = await screen.findByText(/^Pour passer à/)
    const reste = pourPasser.nextElementSibling
    if (!(reste instanceof HTMLElement)) throw new Error('Rien sous « Pour passer à »')
    expect(
      within(reste).getByText('Réussis sans aide l’exercice « Pratique guidée ».'),
    ).toBeVisible()
    expect(reste.textContent).not.toMatch(/\bPR\d/)
  })
})

describe('stockage indisponible', () => {
  it('prévient que les réponses ne peuvent pas être gardées', async () => {
    await afficher({ stockageIndisponible: true })

    expect(
      screen.getByText('Les réponses ne peuvent pas être gardées sur cet appareil.'),
    ).toBeVisible()
  })
})

describe('temps actif', () => {
  it('envoie temps.actif toutes les minutes tant qu’il y a de l’activité', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { envoyer, magasin } = await afficher()
    await envoyer(etape('ET2'))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_500)
    })

    await waitFor(() => {
      expect(magasin.lire().idsRecus.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('garde le type de l’étape affichée avec le temps actif', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { envoyer, magasin } = await afficher()
    await envoyer(etape('ET2'))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_500)
    })

    await waitFor(() => {
      expect(magasin.lire().tempsActif.map(({ etape: type }) => type)).toContain('pretest')
    })
  })
})
