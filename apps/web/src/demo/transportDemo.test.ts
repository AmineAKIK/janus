import { ErreurApi, ErreurDonnees, ErreurReseau, ROUTES } from '@janus/contrats'
import { describe, expect, it, vi } from 'vitest'
import { creerHorlogeDemo } from './horlogeDemo.ts'
import { creerMagasin, etatVide } from './store.ts'
import { creerTransportDemo } from './transportDemo.ts'
import type { RoutesDemo } from './transportDemo.ts'

const T0 = '2026-10-05T10:00:00.000Z'
const MOI = {
  id: '0190a000-0000-7000-8000-00000000d3a0',
  nom_utilisateur: 'amine',
  fuseau: 'Europe/Paris',
}

function monter(routes: RoutesDemo, options: { delaiMs?: number; connecte?: boolean } = {}) {
  const magasin = creerMagasin({ stockage: null, creerEtat: () => etatVide(T0) })
  magasin.ecrire((etat) => ({ ...etat, sessionOuverte: options.connecte ?? true }))
  const horloge = creerHorlogeDemo({ reelle: () => Date.parse(T0) })
  const transport = creerTransportDemo({ magasin, horloge, routes, delaiMs: options.delaiMs ?? 0 })
  return { magasin, horloge, transport }
}

describe('transport de démo', () => {
  it('appelle la route de démo avec l’entrée validée, le store et l’horloge', async () => {
    const route = vi.fn(() => MOI)
    const { transport, magasin, horloge } = monter({ 'GET /moi': route })

    await expect(transport.appeler(ROUTES['GET /moi'], {})).resolves.toEqual(MOI)

    expect(route).toHaveBeenCalledWith(
      expect.objectContaining({ magasin, horloge, route: ROUTES['GET /moi'] }),
    )
  })

  it('valide l’entrée avant d’appeler la route', async () => {
    const route = vi.fn()
    const { transport } = monter({ 'POST /session': route }, { connecte: false })

    await expect(
      transport.appeler(ROUTES['POST /session'], {
        corps: { nom_utilisateur: '', mot_de_passe: 'x' },
      }),
    ).rejects.toBeInstanceOf(ErreurDonnees)
    expect(route).not.toHaveBeenCalled()
  })

  it('valide la sortie comme le fait le vrai serveur', async () => {
    const { transport } = monter({ 'GET /moi': () => ({ ...MOI, fuseau: 12 }) })

    await expect(transport.appeler(ROUTES['GET /moi'], {})).rejects.toBeInstanceOf(ErreurDonnees)
  })

  it('refuse les routes qui demandent une session quand on n’est pas connecté (401)', async () => {
    const route = vi.fn(() => MOI)
    const { transport } = monter({ 'GET /moi': route }, { connecte: false })

    const erreur: unknown = await transport.appeler(ROUTES['GET /moi'], {}).catch((e: unknown) => e)

    expect(erreur).toBeInstanceOf(ErreurApi)
    expect(erreur).toMatchObject({ status: 401, code: 'non_authentifie' })
    expect(route).not.toHaveBeenCalled()
  })

  it('laisse passer la connexion sans session', async () => {
    const { transport } = monter({ 'POST /session': () => MOI }, { connecte: false })

    await expect(
      transport.appeler(ROUTES['POST /session'], {
        corps: { nom_utilisateur: 'amine', mot_de_passe: 'demo-janus' },
      }),
    ).resolves.toEqual(MOI)
  })

  it('dit clairement qu’une route de démo n’est pas encore codée (501)', async () => {
    const { transport } = monter({})

    const erreur: unknown = await transport.appeler(ROUTES['GET /moi'], {}).catch((e: unknown) => e)

    expect(erreur).toMatchObject({
      status: 501,
      detail: expect.stringContaining('GET /moi') as unknown,
    })
  })

  it('répond « serveur injoignable » quand l’interrupteur Hors connexion est levé', async () => {
    const route = vi.fn(() => MOI)
    const { transport, magasin } = monter({ 'GET /moi': route })
    magasin.ecrire((etat) => ({
      ...etat,
      interrupteurs: { ...etat.interrupteurs, horsConnexion: true },
    }))

    await expect(transport.appeler(ROUTES['GET /moi'], {})).rejects.toBeInstanceOf(ErreurReseau)
    expect(route).not.toHaveBeenCalled()
  })

  it('laisse une route écrire dans le store', async () => {
    const { transport, magasin } = monter({
      'DELETE /session': ({ magasin: m }) => {
        m.ecrire((etat) => ({ ...etat, sessionOuverte: false }))
        return undefined
      },
    })

    await expect(transport.appeler(ROUTES['DELETE /session'], {})).resolves.toBeNull()
    expect(magasin.lire().sessionOuverte).toBe(false)
  })

  describe('délai simulé', () => {
    it('l’interrupteur « Réseau lent » ajoute 2 secondes à toutes les routes', async () => {
      vi.useFakeTimers()
      const { transport, magasin } = monter({ 'GET /moi': () => MOI })
      magasin.ecrire((etat) => ({
        ...etat,
        interrupteurs: { ...etat.interrupteurs, reseauLent: true },
      }))
      let reponse: unknown = null
      void transport.appeler(ROUTES['GET /moi'], {}).then((valeur) => {
        reponse = valeur
      })

      await vi.advanceTimersByTimeAsync(1999)
      expect(reponse).toBeNull()
      await vi.advanceTimersByTimeAsync(1)

      expect(reponse).toEqual(MOI)
      vi.useRealTimers()
    })

    it('attend avant de répondre', async () => {
      vi.useFakeTimers()
      const { transport } = monter({ 'GET /moi': () => MOI }, { delaiMs: 800 })
      let reponse: unknown = null
      void transport.appeler(ROUTES['GET /moi'], {}).then((valeur) => {
        reponse = valeur
      })

      await vi.advanceTimersByTimeAsync(799)
      expect(reponse).toBeNull()
      await vi.advanceTimersByTimeAsync(1)

      expect(reponse).toEqual(MOI)
      vi.useRealTimers()
    })

    it('s’arrête quand la requête est abandonnée', async () => {
      vi.useFakeTimers()
      const route = vi.fn(() => MOI)
      const { transport } = monter({ 'GET /moi': route }, { delaiMs: 800 })
      const controle = new AbortController()
      const appel = transport.appeler(ROUTES['GET /moi'], {}, { signal: controle.signal })
      const verdict = expect(appel).rejects.toMatchObject({ name: 'AbortError' })

      controle.abort()
      await verdict

      expect(route).not.toHaveBeenCalled()
      vi.useRealTimers()
    })

    it('refuse tout de suite une requête déjà abandonnée', async () => {
      const route = vi.fn(() => MOI)
      const { transport } = monter({ 'GET /moi': route })

      await expect(
        transport.appeler(ROUTES['GET /moi'], {}, { signal: AbortSignal.abort() }),
      ).rejects.toMatchObject({ name: 'AbortError' })
      expect(route).not.toHaveBeenCalled()
    })
  })
})
