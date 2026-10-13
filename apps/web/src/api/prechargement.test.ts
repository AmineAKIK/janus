import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROUTES } from '@janus/contrats'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AGE_MAX_MS, avecPrechargement, creerPrechargements } from './prechargement.ts'
import { creerTransportHttp } from './transportHttp.ts'

const ICI = dirname(fileURLToPath(import.meta.url))
const amorcage = readFileSync(resolve(ICI, '../../public/amorcage.js'), 'utf8')
const html = readFileSync(resolve(ICI, '../../index.html'), 'utf8')

const MOI = {
  id: '0190a000-0000-7000-8000-000000000001',
  nom_utilisateur: 'amine',
  fuseau: 'Europe/Paris',
}
const reponseMoi = (status = 200) =>
  new Response(JSON.stringify(MOI), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

describe('avecPrechargement', () => {
  it('dit à amorcage.js où sont l’API et la base de l’appli, sans rien changer d’autre', () => {
    const resultat = avecPrechargement(html, '/api/', '/')

    expect(resultat).toContain('<script src="%BASE_URL%amorcage.js" data-api="/api" data-base="/">')
    expect(resultat.replace(/ data-api="\/api" data-base="\/"/u, '')).toBe(html)
  })

  it('laisse une page sans amorcage.js telle quelle', () => {
    expect(avecPrechargement('<html></html>', '/api', '/')).toBe('<html></html>')
  })
})

describe('creerPrechargements', () => {
  const lancee = (reponse: Promise<Response>, debut = 0) => ({ debut, reponse })

  it('rend une réponse réussie, une seule fois', async () => {
    const reponse = reponseMoi()
    const precharges = creerPrechargements(
      { '/api/moi': lancee(Promise.resolve(reponse)) },
      () => 10,
    )

    expect(await precharges.prendre('/api/moi')).toBe(reponse)
    expect(await precharges.prendre('/api/moi')).toBeUndefined()
  })

  it.each([401, 403, 500])(
    'ne rend jamais une réponse %i : elle ne vaut pas pour la lecture d’après une connexion',
    async (status) => {
      const precharges = creerPrechargements(
        { '/api/moi': lancee(Promise.resolve(reponseMoi(status))) },
        () => 10,
      )

      expect(await precharges.prendre('/api/moi')).toBeUndefined()
    },
  )

  it('ne rend rien quand la requête a échoué', async () => {
    const precharges = creerPrechargements(
      { '/api/moi': lancee(Promise.reject(new TypeError('Failed to fetch'))) },
      () => 10,
    )

    expect(await precharges.prendre('/api/moi')).toBeUndefined()
  })

  it('ne rend rien d’une lecture trop vieille', async () => {
    const precharges = creerPrechargements(
      { '/api/moi': lancee(Promise.resolve(reponseMoi()), 0) },
      () => AGE_MAX_MS + 1,
    )

    expect(await precharges.prendre('/api/moi')).toBeUndefined()
  })

  it('ne rend rien pour une adresse non lancée, et ignore ce qui n’est pas une lecture', async () => {
    const precharges = creerPrechargements(
      { '/api/moi': 'pas une lecture', '/api/reglages': { debut: 'x', reponse: 3 } },
      () => 10,
    )

    expect(await precharges.prendre('/api/moi')).toBeUndefined()
    expect(await precharges.prendre('/api/reglages')).toBeUndefined()
    expect(await creerPrechargements(undefined).prendre('/api/moi')).toBeUndefined()
    expect(await creerPrechargements(null).prendre('/api/moi')).toBeUndefined()
  })

  it('oublie tout avec vider', async () => {
    const precharges = creerPrechargements(
      { '/api/moi': lancee(Promise.resolve(reponseMoi())) },
      () => 10,
    )

    precharges.vider()

    expect(await precharges.prendre('/api/moi')).toBeUndefined()
  })
})

describe('transportHttp avec des lectures lancées à l’avance', () => {
  const montage = (lectures: Record<string, { debut: number; reponse: Promise<Response> }>) => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(reponseMoi()))
    const precharges = creerPrechargements(lectures, () => 10)
    return { fetchImpl, transport: creerTransportHttp({ base: '/api', fetchImpl, precharges }) }
  }

  it('reprend la réponse lancée à l’avance sans refaire l’appel, puis appelle normalement', async () => {
    const { fetchImpl, transport } = montage({
      '/api/moi': { debut: 0, reponse: Promise.resolve(reponseMoi()) },
    })

    expect(await transport.appeler(ROUTES['GET /moi'], {})).toEqual(MOI)
    expect(fetchImpl).not.toHaveBeenCalled()

    await transport.appeler(ROUTES['GET /moi'], {})
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('valide la réponse lancée à l’avance comme les autres', async () => {
    const { transport } = montage({
      '/api/moi': {
        debut: 0,
        reponse: Promise.resolve(
          new Response('{"nom":"x"}', { headers: { 'Content-Type': 'application/json' } }),
        ),
      },
    })

    await expect(transport.appeler(ROUTES['GET /moi'], {})).rejects.toThrow()
  })

  it('refait l’appel quand la lecture lancée à l’avance n’a pas réussi', async () => {
    const { fetchImpl, transport } = montage({
      '/api/moi': { debut: 0, reponse: Promise.resolve(reponseMoi(401)) },
    })

    expect(await transport.appeler(ROUTES['GET /moi'], {})).toEqual(MOI)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('respecte l’annulation demandée avant la reprise', async () => {
    const { fetchImpl, transport } = montage({
      '/api/moi': { debut: 0, reponse: Promise.resolve(reponseMoi()) },
    })
    const annulation = new AbortController()
    annulation.abort(new DOMException('abandon', 'AbortError'))

    await expect(
      transport.appeler(ROUTES['GET /moi'], {}, { signal: annulation.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('oublie les lectures lancées avant une écriture (connexion, sortie)', async () => {
    const { fetchImpl, transport } = montage({
      '/api/moi': { debut: 0, reponse: Promise.resolve(reponseMoi()) },
    })

    await transport.appeler(ROUTES['DELETE /session'], {})
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    await transport.appeler(ROUTES['GET /moi'], {})
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})

/** Joue amorcage.js comme le navigateur : en script classique de la page, avec sa balise pour `currentScript`. */
function jouer(chemin: string, attributs: Record<string, string>) {
  Reflect.deleteProperty(window, 'janusPrecharges')
  window.history.pushState({}, '', chemin)
  const balise = document.createElement('script')
  for (const [nom, valeur] of Object.entries(attributs)) balise.setAttribute(nom, valeur)
  Object.defineProperty(document, 'currentScript', { configurable: true, get: () => balise })
  // amorcage.js est un script classique de la page, pas un module : on le joue tel quel, comme le navigateur.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call
  new Function(amorcage)()
  const lancees: unknown = Reflect.get(window, 'janusPrecharges')
  return typeof lancees === 'object' && lancees !== null ? Object.keys(lancees) : []
}

describe('amorcage.js : le préchargement des premières lectures', () => {
  const fetchEspion = vi.fn<typeof fetch>(() => Promise.resolve(reponseMoi()))

  afterEach(() => {
    fetchEspion.mockClear()
    vi.unstubAllGlobals()
    Reflect.deleteProperty(document, 'currentScript')
    Reflect.deleteProperty(window, 'janusPrecharges')
    window.history.pushState({}, '', '/')
  })

  const lancer = (chemin: string, attributs: Record<string, string>) => {
    vi.stubGlobal('fetch', fetchEspion)
    return jouer(chemin, attributs)
  }

  it('lance le compte, les réglages, la journée et les formations sur l’accueil', () => {
    const adresses = lancer('/', { 'data-api': '/api', 'data-base': '/' })

    expect(adresses).toEqual(['/api/moi', '/api/reglages', '/api/aujourdhui', '/api/formations'])
    expect(fetchEspion.mock.calls.map(([adresse]) => adresse)).toEqual(adresses)
    for (const [, init] of fetchEspion.mock.calls) {
      expect(init).toMatchObject({ credentials: 'include' })
    }
  })

  it.each([
    ['/journal', ['moi', 'reglages', 'formations']],
    ['/tableau-de-bord', ['moi', 'reglages', 'formations']],
    ['/formations', ['moi', 'reglages', 'formations']],
    ['/revision', ['moi', 'reglages', 'aujourdhui']],
    ['/parametres', ['moi', 'reglages']],
    ['/blocs/B01', ['moi', 'reglages']],
    ['/constructor', ['moi', 'reglages']],
  ])('sur %s, ne lance que ce que l’écran utilise', (chemin, attendues) => {
    expect(lancer(chemin, { 'data-api': '/api', 'data-base': '/' })).toEqual(
      attendues.map((nom) => `/api/${nom}`),
    )
  })

  it('ne lance rien sur la connexion, ouverte sans session', () => {
    expect(lancer('/connexion', { 'data-api': '/api', 'data-base': '/' })).toEqual([])
    expect(fetchEspion).not.toHaveBeenCalled()
  })

  it('ne lance rien sans API (démo)', () => {
    expect(lancer('/', {})).toEqual([])
    expect(fetchEspion).not.toHaveBeenCalled()
  })

  it('suit la base de l’appli', () => {
    expect(lancer('/janus/', { 'data-api': '/janus/api', 'data-base': '/janus/' })).toContain(
      '/janus/api/aujourdhui',
    )
    expect(
      lancer('/janus/connexion', { 'data-api': '/janus/api', 'data-base': '/janus/' }),
    ).toEqual([])
  })

  it('se laisse reprendre par le transport, à l’adresse exacte de la route', async () => {
    lancer('/', { 'data-api': '/api', 'data-base': '/' })
    const precharges = creerPrechargements(Reflect.get(window, 'janusPrecharges'))
    const fetchImpl = vi.fn<typeof fetch>()
    const transport = creerTransportHttp({ base: '/api', fetchImpl, precharges })

    expect(await transport.appeler(ROUTES['GET /moi'], {})).toEqual(MOI)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('lance les adresses exactes des lectures de l’appli, sans paramètre', () => {
    for (const nom of ['moi', 'formations', 'reglages', 'aujourdhui'] as const) {
      const route = ROUTES[`GET /${nom}`]
      expect(route.chemin).toBe(`/${nom}`)
      expect(amorcage).toContain(`'${nom}'`)
    }
  })
})
