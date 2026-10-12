import { EXEMPLES_PAGE } from '@janus/contrats'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MANIFESTES_GRAINE } from '../demo/graine.ts'
import { creerRouteur } from '../routes/arbre.tsx'
import { creerContexteTest } from '../routes/contexteTest.tsx'

async function ouvrirChemin(chemin: string) {
  const banc = creerContexteTest()
  const routeur = creerRouteur(createMemoryHistory({ initialEntries: [chemin] }), banc.contexte)
  await act(async () => {
    render(banc.application(routeur))
    await routeur.load()
  })
  return { ...banc, routeur }
}

const ouvertures = (magasin: ReturnType<typeof creerContexteTest>['magasin'], bloc: string) =>
  magasin.lire().faits.filter((fait) => fait.type === 'bloc_ouvert' && fait.bloc === bloc)

afterEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
})

describe('l’ouverture d’un bloc par son adresse', () => {
  it('un bloc libre est ouvert en silence, une seule fois par session', async () => {
    const banc = creerContexteTest()
    const avant = ouvertures(banc.magasin, 'B03').length
    const routeur = creerRouteur(
      createMemoryHistory({ initialEntries: ['/blocs/B03'] }),
      banc.contexte,
    )
    await act(async () => {
      render(banc.application(routeur))
      await routeur.load()
    })
    await screen.findByTitle(/^Fiche du bloc B03/)

    await waitFor(() => {
      expect(ouvertures(banc.magasin, 'B03')).toHaveLength(avant + 1)
    })
    expect(ouvertures(banc.magasin, 'B03').at(-1)).toMatchObject({ horsPrerequis: false })
    expect(screen.queryByText('Prérequis manquant')).not.toBeInTheDocument()
    expect(JSON.parse(sessionStorage.getItem('janus.blocs-ouverts') ?? '[]')).toContain('B03')
  })

  it('un bloc dont les prérequis manquent demande la raison avant d’afficher la fiche', async () => {
    const utilisateur = userEvent.setup()
    const { magasin } = await ouvrirChemin('/blocs/B12')

    expect(await screen.findByText('Prérequis manquant')).toBeVisible()
    expect(screen.queryByTitle(/^Fiche du bloc B12/)).not.toBeInTheDocument()
    expect(ouvertures(magasin, 'B12')).toHaveLength(0)

    await utilisateur.type(
      screen.getByLabelText('Pourquoi l’ouvrir quand même ?'),
      'Je veux survoler le sujet',
    )
    await utilisateur.click(screen.getByRole('button', { name: 'Ouvrir quand même' }))

    expect(await screen.findByTitle(/^Fiche du bloc B12/)).toBeVisible()
    expect(ouvertures(magasin, 'B12')).toEqual([
      expect.objectContaining({
        bloc: 'B12',
        horsPrerequis: true,
        raison: 'Je veux survoler le sujet',
      }),
    ])
  })

  it('fermer le dialogue ramène au module sans rien enregistrer', async () => {
    const utilisateur = userEvent.setup()
    const { magasin, routeur } = await ouvrirChemin('/blocs/B12')
    await screen.findByText('Prérequis manquant')

    await utilisateur.click(screen.getByRole('button', { name: 'Fermer' }))

    await waitFor(() => {
      expect(routeur.state.location.pathname).toMatch(/^\/modules\//)
    })
    expect(ouvertures(magasin, 'B12')).toHaveLength(0)
  })
})

describe('l’étape demandée par le lien', () => {
  it('montre l’étape de ?etape= une fois la fiche prête', async () => {
    const etapes = MANIFESTES_GRAINE['B03']?.etapes ?? []
    const demandee = etapes[3]?.id
    if (demandee === undefined) throw new Error('étape de la graine absente')
    await ouvrirChemin(`/blocs/B03?etape=${demandee}`)
    const iframe = await screen.findByTitle(/^Fiche du bloc B03/)
    if (!(iframe instanceof HTMLIFrameElement) || iframe.contentWindow === null) {
      throw new Error('iframe absente')
    }
    const fenetre = iframe.contentWindow
    const recu = vi.spyOn(fenetre, 'postMessage').mockImplementation(() => undefined)

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { ...EXEMPLES_PAGE['page.prete'], bloc: 'B03', version: 1 },
          source: fenetre,
        }),
      )
      await Promise.resolve()
    })

    expect(recu).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'etape.aller', etape: demandee }),
      '*',
    )
  })

  it('ignore une étape qui n’existe pas', async () => {
    await ouvrirChemin('/blocs/B03?etape=ET99')
    const iframe = await screen.findByTitle(/^Fiche du bloc B03/)
    if (!(iframe instanceof HTMLIFrameElement) || iframe.contentWindow === null) {
      throw new Error('iframe absente')
    }
    const fenetre = iframe.contentWindow
    const recu = vi.spyOn(fenetre, 'postMessage').mockImplementation(() => undefined)
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { ...EXEMPLES_PAGE['page.prete'], bloc: 'B03', version: 1 },
          source: fenetre,
        }),
      )
      await Promise.resolve()
    })

    expect(recu).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'etape.aller' }), '*')
  })
})
