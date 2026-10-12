import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const enregistrement = vi.hoisted(() => ({
  precache: vi.fn(),
  nettoyage: vi.fn(),
  revendication: vi.fn(),
  routes: [] as unknown[],
  navigation: vi.fn(),
  gestionnaire: vi.fn(() => 'coque'),
}))

vi.mock('workbox-core', () => ({ clientsClaim: enregistrement.revendication }))
vi.mock('workbox-precaching', () => ({
  precacheAndRoute: enregistrement.precache,
  cleanupOutdatedCaches: enregistrement.nettoyage,
  createHandlerBoundToURL: enregistrement.gestionnaire,
}))
vi.mock('workbox-routing', () => ({
  registerRoute: (...arguments_: unknown[]) => enregistrement.routes.push(arguments_),
  NavigationRoute: class {
    readonly arguments_: unknown[]
    constructor(...arguments_: unknown[]) {
      this.arguments_ = arguments_
      enregistrement.navigation(...arguments_)
    }
  },
}))
vi.mock('workbox-strategies', () => ({
  CacheFirst: class {
    constructor(readonly options: unknown) {}
  },
}))

type Ecouteur = (evenement: unknown) => void

async function charger() {
  vi.resetModules()
  const ecouteurs = new Map<string, Ecouteur>()
  const attendre: Promise<unknown>[] = []
  const soi = {
    __WB_MANIFEST: [{ url: 'index.html', revision: '1' }],
    location: { origin: 'https://janus.test' },
    addEventListener: (type: string, ecouteur: Ecouteur) => ecouteurs.set(type, ecouteur),
    skipWaiting: vi.fn(() => Promise.resolve()),
    registration: { showNotification: vi.fn(() => Promise.resolve()) },
    clients: {
      matchAll: vi.fn(() => Promise.resolve([] as { url: string; focus: () => Promise<void> }[])),
      openWindow: vi.fn(() => Promise.resolve()),
    },
  }
  vi.stubGlobal('self', soi)
  await import('./sw.ts')
  const declencher = (type: string, evenement: Record<string, unknown> = {}) => {
    ecouteurs.get(type)?.({
      ...evenement,
      waitUntil: (promesse: Promise<unknown>) => attendre.push(promesse),
    })
    return Promise.all(attendre)
  }
  return { soi, declencher }
}

beforeEach(() => {
  enregistrement.routes.length = 0
  vi.clearAllMocks()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('service worker', () => {
  it('précache la coque, nettoie les anciens caches et prend la main', async () => {
    const { soi } = await charger()

    expect(enregistrement.precache).toHaveBeenCalledWith(soi.__WB_MANIFEST)
    expect(enregistrement.nettoyage).toHaveBeenCalled()
    expect(enregistrement.revendication).toHaveBeenCalled()
  })

  it('met les fiches en cache d’abord, et laisse l’API au réseau', async () => {
    await charger()

    const [correspondance, strategie] = enregistrement.routes[0] as [
      (contexte: { url: URL }) => boolean,
      { options: { cacheName: string } },
    ]
    expect(strategie.options.cacheName).toBe('fiches')
    expect(correspondance({ url: new URL('https://janus.test/fiches/B03/a.html') })).toBe(true)
    expect(correspondance({ url: new URL('https://janus.test/api/moi') })).toBe(false)
    // Une seule route de ressources : l'API n'a aucune route de cache.
    expect(enregistrement.routes).toHaveLength(2)
  })

  it('la navigation retombe sur la coque, sauf pour un aperçu de PR', async () => {
    await charger()

    expect(enregistrement.gestionnaire).toHaveBeenCalledWith('/index.html')
    const options = enregistrement.navigation.mock.calls[0]?.[1] as { denylist: RegExp[] }
    expect(options.denylist.some((motif) => motif.test('/janus/pr-preview/pr-12/'))).toBe(true)
    expect(options.denylist.some((motif) => motif.test('/revision'))).toBe(false)
  })

  it('SKIP_WAITING active la nouvelle version, tout autre message est ignoré', async () => {
    const { soi, declencher } = await charger()

    await declencher('message', { data: { type: 'AUTRE' } })
    await declencher('message', { data: 'SKIP_WAITING' })
    await declencher('message', { data: null })
    expect(soi.skipWaiting).not.toHaveBeenCalled()

    await declencher('message', { data: { type: 'SKIP_WAITING' } })
    expect(soi.skipWaiting).toHaveBeenCalledOnce()
  })

  it('affiche le rappel du jour avec une étiquette unique', async () => {
    const { soi, declencher } = await charger()

    await declencher('push', {
      data: { json: () => ({ titre: 'Janus', corps: '3 cartes t’attendent' }) },
    })

    expect(soi.registration.showNotification).toHaveBeenCalledWith(
      'Janus',
      expect.objectContaining({ body: '3 cartes t’attendent', tag: 'rappel-du-jour', lang: 'fr' }),
    )
  })

  it('n’affiche rien pour un message illisible', async () => {
    const { soi, declencher } = await charger()

    await declencher('push', { data: { json: () => ({ autre: 1 }) } })
    await declencher('push', { data: null })

    expect(soi.registration.showNotification).not.toHaveBeenCalled()
  })

  it('toucher la notification ramène la fenêtre ouverte sans changer d’écran', async () => {
    const { soi, declencher } = await charger()
    const focus = vi.fn(() => Promise.resolve())
    soi.clients.matchAll.mockResolvedValue([
      { url: 'https://autre.test/', focus: vi.fn() },
      { url: 'https://janus.test/revision', focus },
    ])
    const fermer = vi.fn()

    await declencher('notificationclick', { notification: { close: fermer } })

    expect(fermer).toHaveBeenCalled()
    expect(focus).toHaveBeenCalled()
    expect(soi.clients.openWindow).not.toHaveBeenCalled()
  })

  it('sans fenêtre ouverte, l’appli s’ouvre sur Aujourd’hui', async () => {
    const { soi, declencher } = await charger()

    await declencher('notificationclick', { notification: { close: vi.fn() } })

    expect(soi.clients.openWindow).toHaveBeenCalledWith('/#/')
  })
})
