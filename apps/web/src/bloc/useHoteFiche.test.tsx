import { EXEMPLES_PAGE, ROUTES } from '@janus/contrats'
import { MANIFESTES_GRAINE } from '../demo/graine.ts'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { creerRouteur } from '../routes/arbre.tsx'
import { creerContexteTest } from '../routes/contexteTest.tsx'
import { DELAI_FICHE_MS } from './useHoteFiche.ts'

async function afficher(chemin = '/blocs/B03') {
  const banc = creerContexteTest()
  const routeur = creerRouteur(createMemoryHistory({ initialEntries: [chemin] }), banc.contexte)
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
  const envoyer = async (data: unknown, source: unknown = fenetre) => {
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', { data, source: source as MessageEventSource }),
      )
      await Promise.resolve()
    })
  }
  return { ...banc, routeur, iframe, fenetre, recu, envoyer }
}

const prete = { ...EXEMPLES_PAGE['page.prete'], version: 1 }
const message = (type: keyof typeof EXEMPLES_PAGE, extra: object = {}) => ({
  ...EXEMPLES_PAGE[type],
  bloc: 'B03',
  version: 1,
  ...extra,
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('page d’un bloc', () => {
  it('affiche la barre : retour, code, titre et statut, et l’iframe de la fiche', async () => {
    const { iframe } = await afficher()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      MANIFESTES_GRAINE['B03']?.titre ?? '',
    )
    expect(screen.getByText('B03')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Retour aux blocs' })).toHaveAttribute(
      'href',
      '/modules/M1?detail=B03',
    )
    expect(screen.getByText('✓ Enregistré')).toBeVisible()
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts')
    expect(iframe.getAttribute('referrerpolicy')).toBe('no-referrer')
    expect(iframe.getAttribute('src')).toContain('fiche-demo.html')
  })

  it('fait la poignée de main : page.prete reçoit etat.init avec le bloc, la version et le statut', async () => {
    const { envoyer, recu } = await afficher()

    await envoyer(prete)

    expect(recu).toHaveBeenCalledOnce()
    expect(recu).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'etat.init',
        bloc: 'B03',
        version: 1,
        etat: null,
        statut: 'en_cours',
        serie_ouverte: { restitution: true, consolidation: false },
      }),
      '*',
    )
  })

  it('renvoie etat.init à jour quand la fiche est rechargée', async () => {
    const { envoyer, recu } = await afficher()

    await envoyer(prete)
    await envoyer(message('etat.sauver', { etat: { etape: 'ET2' } }))
    await envoyer(prete)

    const inits = recu.mock.calls.filter(([m]) => (m as { type: string }).type === 'etat.init')
    expect(inits).toHaveLength(2)
    expect(inits[1]?.[0]).toMatchObject({ etat: { etape: 'ET2' } })
  })

  it('ignore un message d’une autre fenêtre, sans lui répondre', async () => {
    const { envoyer, recu } = await afficher()
    const avertir = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await envoyer(prete, window)

    expect(recu).not.toHaveBeenCalled()
    expect(avertir).toHaveBeenCalledWith(expect.stringContaining('source_inconnue'))
  })

  it('ignore un message d’un autre bloc et répond « message refusé »', async () => {
    const { envoyer, recu } = await afficher()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await envoyer(message('etape.vue', { bloc: 'B04' }))

    expect(recu).toHaveBeenCalledWith(
      { type: 'erreur', code: 'message_refuse', detail: 'message refusé' },
      '*',
    )
  })

  it('relaie un événement au serveur et renvoie le statut recalculé à la page', async () => {
    const { envoyer, recu, magasin } = await afficher()

    await envoyer(message('etape.vue', { etape: 'ET2' }))

    await waitFor(() => {
      expect(magasin.lire().idsRecus).toContain(EXEMPLES_PAGE['etape.vue'].id)
    })
    await waitFor(() => {
      expect(recu).toHaveBeenCalledWith(expect.objectContaining({ type: 'statut.maj' }), '*')
    })
  })

  it('sauvegarde l’état de la page sur le serveur', async () => {
    const { envoyer, transport } = await afficher()

    await envoyer(message('etat.sauver', { etat: { etape: 'ET4' } }))

    await waitFor(async () => {
      const bloc = await transport.appeler(ROUTES['GET /blocs/:id'], { params: { id: 'B03' } })
      expect(bloc.etat_page?.etat).toEqual({ etape: 'ET4' })
    })
  })

  it('dit que la fiche ne répond pas au bout de 10 secondes, et la recharge', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { iframe } = await afficher()
    const utilisateur = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    expect(screen.getByText('Chargement de la fiche…')).toBeVisible()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELAI_FICHE_MS + 100)
    })

    expect(screen.getByRole('alert')).toHaveTextContent('La fiche ne répond pas.')
    await utilisateur.click(screen.getByRole('button', { name: 'Recharger la fiche' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByTitle(/^Fiche du bloc B03/)).not.toBe(iframe)
  })

  it('ne dit rien quand la fiche répond à temps', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { envoyer } = await afficher()

    await envoyer(prete)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELAI_FICHE_MS + 100)
    })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('Chargement de la fiche…')).not.toBeInTheDocument()
  })
})
