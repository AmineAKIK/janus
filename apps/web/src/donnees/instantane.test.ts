import { nomRoute, Reglages, ROUTES } from '@janus/contrats'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { capturer, derniereMiseAJour, restaurer } from './instantane.ts'

const REGLAGES = [nomRoute(ROUTES['GET /reglages']), {}] as const
const MOI = [nomRoute(ROUTES['GET /moi']), {}] as const

describe('instantané des données', () => {
  it('ne garde que les lectures des écrans de consultation', () => {
    const client = new QueryClient()
    client.setQueryData(REGLAGES, Reglages.parse({}), { updatedAt: 1000 })
    client.setQueryData(MOI, { nom_utilisateur: 'amine' })
    client.setQueryData([nomRoute(ROUTES['GET /sessions']), {}], { sessions: [] })
    client.setQueryData([nomRoute(ROUTES['GET /verifications/:id']), { params: { id: 'x' } }], {})

    expect(capturer(client).requetes).toEqual([
      { cle: [...REGLAGES], donnees: Reglages.parse({}), mis_a_jour: 1000 },
    ])
  })

  it('reprend ce qui a été gardé, avec son instant de lecture', () => {
    const origine = new QueryClient()
    origine.setQueryData(REGLAGES, Reglages.parse({ questionsDebut: 8 }), { updatedAt: 5000 })
    const instantane = JSON.parse(JSON.stringify(capturer(origine))) as unknown

    const client = new QueryClient()
    expect(restaurer(client, instantane)).toBe(1)
    expect(client.getQueryData(REGLAGES)).toEqual(Reglages.parse({ questionsDebut: 8 }))
    expect(client.getQueryState(REGLAGES)?.dataUpdatedAt).toBe(5000)
  })

  it('marque ce qui est repris comme périmé, pour que chaque écran le relise', () => {
    const origine = new QueryClient()
    origine.setQueryData(REGLAGES, Reglages.parse({}), { updatedAt: Date.now() })
    const client = new QueryClient()
    restaurer(client, JSON.parse(JSON.stringify(capturer(origine))) as unknown)
    expect(client.getQueryState(REGLAGES)?.isInvalidated).toBe(true)
  })

  it('jette ce qui ne passe plus le schéma de sa route, ou qui n’a pas lieu d’être gardé', () => {
    const client = new QueryClient()
    const brut = {
      version: 1,
      requetes: [
        { cle: [...REGLAGES], donnees: { questionsDebut: 99 }, mis_a_jour: 1 },
        { cle: [...MOI], donnees: { nom_utilisateur: 'amine' }, mis_a_jour: 1 },
        { cle: ['GET /inconnue', {}], donnees: {}, mis_a_jour: 1 },
      ],
    }

    expect(restaurer(client, brut)).toBe(0)
    expect(client.getQueryCache().findAll()).toHaveLength(0)
  })

  it('ignore un enregistrement abîmé', () => {
    const client = new QueryClient()
    expect(restaurer(client, 'n’importe quoi')).toBe(0)
    expect(restaurer(client, { version: 2, requetes: [] })).toBe(0)
    expect(restaurer(client, undefined)).toBe(0)
  })

  it('donne l’instant de la lecture la plus récente', () => {
    const client = new QueryClient()
    expect(derniereMiseAJour(client)).toBeNull()
    client.setQueryData(REGLAGES, Reglages.parse({}), { updatedAt: 2000 })
    client.setQueryData(
      [nomRoute(ROUTES['GET /formations']), {}],
      { formations: [] },
      { updatedAt: 9000 },
    )
    client.setQueryData(MOI, {}, { updatedAt: 99_000 })
    expect(derniereMiseAJour(client)).toBe(9000)
  })
})
