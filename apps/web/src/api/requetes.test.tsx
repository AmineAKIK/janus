import { ErreurApi, ErreurDonnees, ROUTES } from '@janus/contrats'
import type { Transport } from '@janus/contrats'
import { act, render, screen, waitFor } from '@testing-library/react'
import { Component } from 'react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { creerClientRequetes, FournisseurApi, useEcriture, useLecture } from './requetes.tsx'

const MOI = {
  id: '0190a000-0000-7000-8000-000000000001',
  nom_utilisateur: 'amine',
  fuseau: 'Europe/Paris',
}

const erreurApi = (status: number) =>
  new ErreurApi({
    status,
    code: status === 401 ? 'non_authentifie' : 'conflit',
    titre: 'x',
    detail: 'y',
  })

function transportQui(appeler: (...args: unknown[]) => Promise<unknown>): Transport {
  // Le faux transport accepte n'importe quelle route : les tests ne regardent que ce qu'il reçoit.
  return { appeler } as Transport
}

afterEach(() => {
  vi.restoreAllMocks()
})

function Moi() {
  const moi = useLecture(ROUTES['GET /moi'], {})
  if (moi.isPending) return <p>Chargement</p>
  if (moi.isError) return <p>Échec : {moi.error.message}</p>
  return <p>Bonjour {moi.data.nom_utilisateur}</p>
}

function Deconnexion() {
  const deconnexion = useEcriture(ROUTES['DELETE /session'])
  return (
    <button
      onClick={() => {
        deconnexion.mutate({})
      }}
    >
      Se déconnecter
    </button>
  )
}

function afficher(transport: Transport, enfant: ReactNode, surNonAuthentifie = vi.fn()) {
  const client = creerClientRequetes({ surNonAuthentifie })
  render(
    <FournisseurApi transport={transport} client={client}>
      {enfant}
    </FournisseurApi>,
  )
  return { client, surNonAuthentifie }
}

describe('lectures', () => {
  it('appellent le transport avec le signal d’annulation et rendent la donnée validée', async () => {
    const appeler = vi.fn<(...parametres: unknown[]) => Promise<unknown>>(() =>
      Promise.resolve(MOI),
    )
    afficher(transportQui(appeler), <Moi />)

    expect(await screen.findByText('Bonjour amine')).toBeInTheDocument()
    const [route, entree, options] = appeler.mock.calls[0] ?? []
    expect(route).toBe(ROUTES['GET /moi'])
    expect(entree).toEqual({})
    expect(options).toMatchObject({ signal: expect.any(AbortSignal) as unknown })
  })

  it('gardent les données fraîches 30 secondes', () => {
    const { queries } = creerClientRequetes({ surNonAuthentifie: vi.fn() }).getDefaultOptions()

    expect(queries?.staleTime).toBe(30_000)
  })

  it('sont retentées une fois après une panne', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const appeler = vi.fn().mockRejectedValueOnce(new Error('panne')).mockResolvedValue(MOI)
    afficher(transportQui(appeler), <Moi />)

    expect(await screen.findByText('Bonjour amine', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(appeler).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('ne sont retentées qu’une fois, pas deux', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const appeler = vi.fn(() => Promise.reject(new Error('panne')))
    afficher(transportQui(appeler), <Moi />)

    expect(await screen.findByText('Échec : panne', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(appeler).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('ne sont pas retentées après une erreur du client ou une réponse hors schéma', () => {
    const { queries } = creerClientRequetes({ surNonAuthentifie: vi.fn() }).getDefaultOptions()
    const retenter = queries?.retry as (n: number, e: unknown) => boolean

    expect(retenter(0, new Error('panne'))).toBe(true)
    expect(retenter(1, new Error('panne'))).toBe(false)
    expect(retenter(0, erreurApi(404))).toBe(false)
    expect(retenter(0, new ErreurDonnees('sortie', 'GET /moi', []))).toBe(false)
    expect(
      retenter(0, new ErreurApi({ status: 503, code: 'erreur_interne', titre: 'x', detail: 'y' })),
    ).toBe(true)
  })
})

describe('écritures', () => {
  it('ne sont jamais retentées', async () => {
    const appeler = vi.fn(() => Promise.reject(new Error('panne')))
    const { client } = afficher(transportQui(appeler), <Deconnexion />)

    await act(async () => {
      screen.getByRole('button').click()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(client.isMutating()).toBe(0)
    })
    expect(appeler).toHaveBeenCalledTimes(1)
    expect(client.getDefaultOptions().mutations?.retry).toBe(false)
  })
})

describe('401', () => {
  it('vide le cache et mène à la connexion', async () => {
    const appeler = vi.fn(() => Promise.reject(erreurApi(401)))
    const { client, surNonAuthentifie } = afficher(transportQui(appeler), <Moi />)
    client.setQueryData(['autre'], 'donnée')

    await waitFor(() => {
      expect(surNonAuthentifie).toHaveBeenCalledOnce()
    })
    expect(client.getQueryData(['autre'])).toBeUndefined()
    // La lecture encore affichée est relancée par le vidage du cache : elle ne boucle pas.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(surNonAuthentifie).toHaveBeenCalledOnce()
    expect(appeler.mock.calls.length).toBeLessThanOrEqual(2)
  })

  it('vaut aussi pour une écriture', async () => {
    const appeler = vi.fn(() => Promise.reject(erreurApi(401)))
    const { surNonAuthentifie } = afficher(transportQui(appeler), <Deconnexion />)

    act(() => {
      screen.getByRole('button').click()
    })

    await waitFor(() => {
      expect(surNonAuthentifie).toHaveBeenCalledOnce()
    })
  })
})

describe('401 après une reconnexion', () => {
  it('est traité de nouveau une fois qu’une requête a réussi', async () => {
    const appeler = vi
      .fn()
      .mockRejectedValueOnce(erreurApi(401))
      .mockResolvedValueOnce(MOI)
      .mockRejectedValue(erreurApi(401))
    const { client, surNonAuthentifie } = afficher(transportQui(appeler), <Moi />)
    await waitFor(() => {
      expect(surNonAuthentifie).toHaveBeenCalledTimes(1)
    })
    await screen.findByText('Bonjour amine')

    await act(async () => {
      await client.invalidateQueries()
    })

    await waitFor(() => {
      expect(surNonAuthentifie).toHaveBeenCalledTimes(2)
    })
  })
})

describe('409', () => {
  it('recharge les données', async () => {
    const appeler = vi
      .fn()
      .mockResolvedValueOnce(MOI)
      .mockRejectedValueOnce(erreurApi(409))
      .mockResolvedValue({ ...MOI, nom_utilisateur: 'amine-rechargé' })
    afficher(
      transportQui(appeler),
      <>
        <Moi />
        <Deconnexion />
      </>,
    )
    await screen.findByText('Bonjour amine')

    act(() => {
      screen.getByRole('button').click()
    })

    expect(await screen.findByText('Bonjour amine-rechargé')).toBeInTheDocument()
  })
})

describe('réponse hors schéma', () => {
  class Frontiere extends Component<{ children: ReactNode }, { erreur: Error | null }> {
    override state = { erreur: null as Error | null }
    static getDerivedStateFromError(erreur: Error) {
      return { erreur }
    }
    override render() {
      return this.state.erreur === null ? (
        this.props.children
      ) : (
        <p role="alert">{this.state.erreur.message}</p>
      )
    }
  }

  it('est journalisée en console et remonte à la frontière d’erreur', async () => {
    const journal = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const horsSchema = new ErreurDonnees('sortie', 'GET /moi', [])
    afficher(
      transportQui(() => Promise.reject(horsSchema)),
      <Frontiere>
        <Moi />
      </Frontiere>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Réponse invalide pour GET /moi')
    expect(journal).toHaveBeenCalledWith(expect.stringContaining('[janus] Réponse invalide'), [])
  })
})

describe('transport manquant', () => {
  it('lève une erreur claire hors du fournisseur', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(() => render(<Moi />)).toThrow('FournisseurApi manquant')
  })
})
