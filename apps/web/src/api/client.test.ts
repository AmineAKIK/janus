import { ROUTES } from '@janus/contrats'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { creerTransport, modeTransport } from './client.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

function lireOutilsDemo(): Window['__janusDemo'] {
  return window.__janusDemo
}

describe('modeTransport', () => {
  it('prend la démo par défaut et http sur demande', () => {
    expect(modeTransport(undefined)).toBe('demo')
    expect(modeTransport('n-importe-quoi')).toBe('demo')
    expect(modeTransport('http')).toBe('http')
  })
})

describe('creerTransport', () => {
  it('en http, appelle VITE_API (par défaut /api)', async () => {
    const fetchMock = vi.fn<(adresse: string) => Promise<Response>>(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    )
    vi.stubGlobal('fetch', fetchMock)

    await creerTransport({ VITE_TRANSPORT: 'http' }).appeler(ROUTES['DELETE /session'], {})
    await creerTransport({ VITE_TRANSPORT: 'http', VITE_API: 'https://api.example/v1' }).appeler(
      ROUTES['DELETE /session'],
      {},
    )

    expect(fetchMock.mock.calls.map(([adresse]) => adresse)).toEqual([
      '/api/session',
      'https://api.example/v1/session',
    ])
  })

  it('en démo, n’appelle jamais le réseau et expose window.__janusDemo', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    delete window.__janusDemo

    const erreur: unknown = await creerTransport({})
      .appeler(ROUTES['GET /tableau-de-bord'], {})
      .catch((e: unknown) => e)

    expect(erreur).toMatchObject({ status: 501 })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(Object.keys(lireOutilsDemo() ?? {}).sort()).toEqual([
      'avancer',
      'interrupteur',
      'lire',
      'reinitialiser',
    ])
  })

  it('au premier lancement, la démo part de la graine, puis la retrouve au rechargement', () => {
    localStorage.clear()

    creerTransport({})
    const lire = (): unknown => JSON.parse(localStorage.getItem('janus.demo.v1') ?? 'null')
    const premier = lire()
    creerTransport({})

    expect(JSON.stringify(premier)).toContain('"graine-B01-01"')
    expect(lire()).toEqual(premier)
  })

  it('en http, window.__janusDemo n’existe pas', () => {
    delete window.__janusDemo
    vi.stubGlobal('fetch', vi.fn())

    creerTransport({ VITE_TRANSPORT: 'http' })

    expect(window.__janusDemo).toBeUndefined()
  })
})
