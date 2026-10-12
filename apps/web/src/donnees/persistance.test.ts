import { nomRoute, Reglages, ROUTES } from '@janus/contrats'
import { QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DELAI_ECRITURE_MS, garderLesDonnees, reprendreLesDonnees } from './persistance.ts'
import { creerStockageDonneesMemoire } from './stockageDonnees.ts'
import type { StockageDonnees } from './stockageDonnees.ts'

const REGLAGES = [nomRoute(ROUTES['GET /reglages']), {}] as const

afterEach(() => {
  vi.useRealTimers()
})

describe('persistance des données', () => {
  it('garde les lectures peu après leur arrivée, en une seule écriture', async () => {
    vi.useFakeTimers()
    const stockage = creerStockageDonneesMemoire()
    const ecrire = vi.spyOn(stockage, 'ecrire')
    const client = new QueryClient()
    const arreter = garderLesDonnees(client, stockage)

    client.setQueryData(REGLAGES, Reglages.parse({}))
    client.setQueryData([nomRoute(ROUTES['GET /formations']), {}], { formations: [] })
    expect(ecrire).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(DELAI_ECRITURE_MS)

    expect(ecrire).toHaveBeenCalledOnce()
    const restaure = new QueryClient()
    expect(await reprendreLesDonnees(restaure, stockage)).toBe(2)
    arreter()
  })

  it('vide le stockage dès que le cache est vidé (déconnexion, session perdue)', async () => {
    vi.useFakeTimers()
    const stockage = creerStockageDonneesMemoire()
    const effacer = vi.spyOn(stockage, 'effacer')
    const client = new QueryClient()
    garderLesDonnees(client, stockage)
    client.setQueryData(REGLAGES, Reglages.parse({}))
    await vi.advanceTimersByTimeAsync(DELAI_ECRITURE_MS)
    expect(await stockage.lire()).toBeDefined()

    client.clear()
    await vi.advanceTimersByTimeAsync(0)

    expect(effacer).toHaveBeenCalled()
    expect(await stockage.lire()).toBeUndefined()
  })

  it('n’écrit pas une lecture d’un écran qui n’est pas gardé', async () => {
    vi.useFakeTimers()
    const stockage = creerStockageDonneesMemoire()
    const ecrire = vi.spyOn(stockage, 'ecrire')
    const client = new QueryClient()
    garderLesDonnees(client, stockage)

    client.setQueryData([nomRoute(ROUTES['GET /moi']), {}], { nom_utilisateur: 'amine' })
    await vi.advanceTimersByTimeAsync(DELAI_ECRITURE_MS)

    expect(ecrire).not.toHaveBeenCalled()
    expect(await stockage.lire()).toBeUndefined()
  })

  it('s’ouvre sans données quand le stockage répond trop tard ou échoue', async () => {
    vi.useFakeTimers()
    const lent: StockageDonnees = {
      lire: () => new Promise(() => undefined),
      ecrire: () => Promise.resolve(),
      effacer: () => Promise.resolve(),
    }
    const reprise = reprendreLesDonnees(new QueryClient(), lent, 800)
    await vi.advanceTimersByTimeAsync(800)
    await expect(reprise).resolves.toBe(0)

    const casse: StockageDonnees = { ...lent, lire: () => Promise.reject(new Error('refusé')) }
    await expect(reprendreLesDonnees(new QueryClient(), casse)).resolves.toBe(0)
  })

  it('ne casse pas l’appli quand l’écriture échoue', async () => {
    vi.useFakeTimers()
    const plein: StockageDonnees = {
      lire: () => Promise.resolve(undefined),
      ecrire: () => Promise.reject(new Error('quota')),
      effacer: () => Promise.resolve(),
    }
    const client = new QueryClient()
    garderLesDonnees(client, plein)
    client.setQueryData(REGLAGES, Reglages.parse({}))
    await vi.advanceTimersByTimeAsync(DELAI_ECRITURE_MS)
    expect(client.getQueryData(REGLAGES)).toBeDefined()
  })
})
