import { ErreurApi, ErreurDonnees, ErreurReseau, ROUTES } from '@janus/contrats'
import { describe, expect, it, vi } from 'vitest'
import { creerTransportHttp } from './transportHttp.ts'

const MOI = {
  id: '0190a000-0000-7000-8000-000000000001',
  nom_utilisateur: 'amine',
  fuseau: 'Europe/Paris',
}

function reponseJson(corps: unknown, init: ResponseInit = {}, type = 'application/json') {
  const { headers, ...reste } = init
  const enTetes = new Headers(headers)
  enTetes.set('Content-Type', type)
  return new Response(JSON.stringify(corps), { status: 200, ...reste, headers: enTetes })
}

function transportAvec(reponse: Response | { readonly echec: Error }) {
  const fetchImpl = vi.fn<typeof fetch>(() =>
    reponse instanceof Response ? Promise.resolve(reponse) : Promise.reject(reponse.echec),
  )
  return { fetchImpl, transport: creerTransportHttp({ base: '/api/', fetchImpl }) }
}

describe('requête', () => {
  it('envoie les cookies, le corps JSON et le signal à l’adresse de la route', async () => {
    const { fetchImpl, transport } = transportAvec(reponseJson(MOI))
    const signal = new AbortController().signal

    await transport.appeler(
      ROUTES['POST /session'],
      { corps: { nom_utilisateur: 'amine', mot_de_passe: 'demo-janus' } },
      { signal },
    )

    const [adresse, init] = fetchImpl.mock.calls[0] ?? []
    expect(adresse).toBe('/api/session')
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ nom_utilisateur: 'amine', mot_de_passe: 'demo-janus' }),
      signal,
    })
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json')
  })

  it('remplit les paramètres d’URL et ajoute la requête', async () => {
    const { fetchImpl, transport } = transportAvec(reponseJson({ entrees: [] }))

    await transport.appeler(ROUTES['GET /journal'], {
      requete: { limite: '50' },
    })

    expect(fetchImpl.mock.calls[0]?.[0]).toBe('/api/journal?limite=50')
    expect(fetchImpl.mock.calls[0]?.[1]).not.toHaveProperty('body')
  })

  it('n’envoie rien quand l’entrée est invalide', async () => {
    const { fetchImpl, transport } = transportAvec(reponseJson(MOI))

    await expect(
      transport.appeler(ROUTES['POST /session'], {
        corps: { nom_utilisateur: '', mot_de_passe: 'x' },
      }),
    ).rejects.toBeInstanceOf(ErreurDonnees)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('réponse', () => {
  it('rend la réponse validée', async () => {
    const { transport } = transportAvec(reponseJson(MOI))

    await expect(transport.appeler(ROUTES['GET /moi'], {})).resolves.toEqual(MOI)
  })

  it('rend null pour une réponse sans corps', async () => {
    const { transport } = transportAvec(new Response(null, { status: 204 }))

    await expect(transport.appeler(ROUTES['DELETE /session'], {})).resolves.toBeNull()
  })

  it('lit un texte brut', async () => {
    const { transport } = transportAvec(
      new Response('2026-10-05 matin', { headers: { 'Content-Type': 'text/plain' } }),
    )

    await expect(transport.appeler(ROUTES['GET /journal/export.txt'], {})).resolves.toBe(
      '2026-10-05 matin',
    )
  })

  it('refuse une réponse qui ne respecte pas son schéma', async () => {
    const { transport } = transportAvec(reponseJson({ ...MOI, fuseau: 12 }))

    const erreur: unknown = await transport.appeler(ROUTES['GET /moi'], {}).catch((e: unknown) => e)

    expect(erreur).toBeInstanceOf(ErreurDonnees)
    expect(erreur).toMatchObject({ sens: 'sortie', route: 'GET /moi' })
  })

  it('refuse un corps qui n’est pas du JSON', async () => {
    const { transport } = transportAvec(
      new Response('<html>', { headers: { 'Content-Type': 'application/json' } }),
    )

    await expect(transport.appeler(ROUTES['GET /moi'], {})).rejects.toBeInstanceOf(ErreurDonnees)
  })
})

describe('erreurs', () => {
  const probleme = {
    type: 'https://janus.example/problemes/trop-de-requetes',
    title: 'Trop de requêtes',
    status: 429,
    detail: 'Réessaie dans une minute.',
    code: 'trop_de_requetes',
  }

  it('transforme un problem+json en ErreurApi, avec Retry-After', async () => {
    const { transport } = transportAvec(
      reponseJson(
        probleme,
        { status: 429, headers: { 'Retry-After': '60' } },
        'application/problem+json',
      ),
    )

    const erreur: unknown = await transport.appeler(ROUTES['GET /moi'], {}).catch((e: unknown) => e)

    expect(erreur).toBeInstanceOf(ErreurApi)
    expect(erreur).toMatchObject({
      status: 429,
      code: 'trop_de_requetes',
      titre: 'Trop de requêtes',
      detail: 'Réessaie dans une minute.',
      retryAfter: 60,
    })
  })

  it('sans Retry-After, retryAfter reste absent', async () => {
    const { transport } = transportAvec(
      reponseJson({ ...probleme, status: 401, code: 'non_authentifie' }, { status: 401 }),
    )

    const erreur: unknown = await transport.appeler(ROUTES['GET /moi'], {}).catch((e: unknown) => e)

    expect(erreur).toMatchObject({ status: 401, code: 'non_authentifie', retryAfter: undefined })
  })

  it('ne devine pas le contenu d’une erreur qui n’est pas un problem+json', async () => {
    const { transport } = transportAvec(
      new Response('Bad Gateway', { status: 502, headers: { 'Content-Type': 'text/html' } }),
    )

    const erreur: unknown = await transport.appeler(ROUTES['GET /moi'], {}).catch((e: unknown) => e)

    expect(erreur).toMatchObject({ status: 502, code: 'erreur_interne' })
  })

  it('signale un serveur injoignable', async () => {
    const { transport } = transportAvec({ echec: new TypeError('Failed to fetch') })

    await expect(transport.appeler(ROUTES['GET /moi'], {})).rejects.toBeInstanceOf(ErreurReseau)
  })

  it('laisse passer une requête abandonnée', async () => {
    const abandon = new DOMException('abandon', 'AbortError')
    const { transport } = transportAvec({ echec: abandon })

    await expect(transport.appeler(ROUTES['GET /moi'], {})).rejects.toBe(abandon)
  })
})
