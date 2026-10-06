import { EXEMPLES_PAGE } from '@janus/contrats'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MANIFESTES_GRAINE } from '../demo/graine.ts'
import { creerRouteur } from '../routes/arbre.tsx'
import { creerContexteTest } from '../routes/contexteTest.tsx'

const MANIFESTE = MANIFESTES_GRAINE['B03']
const ETAPES = MANIFESTE?.etapes ?? []
const etape = (type: string) => ETAPES.find((candidate) => candidate.type === type)?.id
const QUESTIONS = MANIFESTE?.restitution.map(({ id }) => id) ?? []

async function afficher() {
  const banc = creerContexteTest()
  const routeur = creerRouteur(
    createMemoryHistory({ initialEntries: ['/blocs/B03'] }),
    banc.contexte,
  )
  await act(async () => {
    render(banc.application(routeur))
    await routeur.load()
  })
  const iframe = await screen.findByTitle(/^Fiche du bloc B03/)
  if (!(iframe instanceof HTMLIFrameElement) || iframe.contentWindow === null) {
    throw new Error('iframe absente')
  }
  const fenetre = iframe.contentWindow
  const recu = vi.spyOn(fenetre, 'postMessage').mockImplementation(() => undefined)
  const envoyer = async (data: unknown) => {
    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', { data, source: fenetre }))
      await Promise.resolve()
    })
  }
  const message = (type: keyof typeof EXEMPLES_PAGE, extra: object = {}) => ({
    ...EXEMPLES_PAGE[type],
    bloc: 'B03',
    version: 1,
    ...extra,
  })
  const repondreATout = async () => {
    for (const [rang, question] of QUESTIONS.entries()) {
      await envoyer(
        message('restitution.demande', {
          id: `0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a${String(rang).padStart(2, '0')}`,
          question,
        }),
      )
    }
    await waitFor(() => {
      expect(
        banc.magasin.lire().faits.filter(({ type }) => type === 'correction').length,
      ).toBeGreaterThan(QUESTIONS.length - 1)
    })
  }
  return { ...banc, routeur, recu, envoyer, message, repondreATout }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('encart de consolidation', () => {
  it('annonce l’heure quand la restitution est faite et la consolidation pas encore ouverte', async () => {
    const { envoyer, message, repondreATout } = await afficher()
    await repondreATout()

    await envoyer(message('etape.vue', { etape: etape('consolidation') }))

    const encart = (await screen.findByText(/Consolidation disponible à/)).parentElement
    expect(encart).toHaveTextContent(/Consolidation disponible à .*\d h \d\d/)
    expect(encart).toHaveTextContent('Au moins 1 h après la restitution.')
    expect(encart).toHaveTextContent('On te le rappellera sur Aujourd’hui.')
  })

  it('suit le réglage du délai de consolidation', async () => {
    const { envoyer, message, repondreATout, magasin, client } = await afficher()
    magasin.ecrire((etat) => ({
      ...etat,
      reglages: { ...etat.reglages, delaiConsolidationMinutes: 90 },
    }))
    await act(async () => {
      await client.invalidateQueries()
    })
    await repondreATout()

    await envoyer(message('etape.vue', { etape: etape('consolidation') }))

    expect(await screen.findByText(/Au moins 1 h 30 après la restitution/)).toBeVisible()
  })

  it('disparaît à l’heure dite sans recharger, et la page reçoit la série ouverte', async () => {
    const { envoyer, message, repondreATout, horloge, client, recu } = await afficher()
    await envoyer(message('page.prete', { schema: 2 }))
    await repondreATout()
    await envoyer(message('etape.vue', { etape: etape('consolidation') }))
    expect(await screen.findByText(/Consolidation disponible à/)).toBeVisible()

    await act(async () => {
      horloge.avancer(61 * 60 * 1000)
      await client.invalidateQueries()
    })

    await waitFor(() => {
      expect(screen.queryByText(/Consolidation disponible à/)).not.toBeInTheDocument()
    })
    expect(recu).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'etat.init',
        serie_ouverte: { restitution: false, consolidation: true },
      }),
      '*',
    )
  })

  it('ne s’affiche pas pendant la restitution ni avant que la restitution soit finie', async () => {
    const { envoyer, message } = await afficher()

    await envoyer(message('etape.vue', { etape: etape('consolidation') }))

    expect(screen.queryByText(/Consolidation disponible à/)).not.toBeInTheDocument()
  })
})

describe('encart du bilan', () => {
  it('donne le statut calculé et ce qui manque pour le suivant', async () => {
    const { envoyer, message, repondreATout } = await afficher()
    await repondreATout()

    await envoyer(message('etape.vue', { etape: etape('bilan') }))

    expect(await screen.findByText('Pour passer à Acquis provisoirement')).toBeVisible()
    expect(screen.getByText(/Statut calculé/)).toBeVisible()
    expect(screen.getByText(/La consolidation sera possible à partir de/)).toBeVisible()
  })

  it('ne s’affiche qu’à l’étape du bilan', async () => {
    const { envoyer, message } = await afficher()

    await envoyer(message('etape.vue', { etape: etape('restitution') }))

    expect(screen.queryByText(/Statut calculé/)).not.toBeInTheDocument()
  })
})
