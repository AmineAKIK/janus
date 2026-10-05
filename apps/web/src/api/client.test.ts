import { ROUTES } from '@janus/contrats'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { creerTransport, modeTransport } from './client.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

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

  it('en démo, n’appelle jamais le réseau', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(creerTransport({}).appeler(ROUTES['GET /moi'], {})).rejects.toThrow('PR-032')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
