import { nomRoute, ROUTES } from '@janus/contrats'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { invaliderApprentissage } from './invalidations.ts'

describe("invaliderApprentissage : les lectures de l'avancement sont relues", () => {
  it('invalide le tableau de bord, la journée et le bloc, pas les réglages', async () => {
    const client = new QueryClient()
    const cles = {
      tableau: [nomRoute(ROUTES['GET /tableau-de-bord']), {}],
      jour: [nomRoute(ROUTES['GET /aujourdhui']), {}],
      bloc: [nomRoute(ROUTES['GET /blocs/:id']), { params: { id: 'B' } }],
      reglages: [nomRoute(ROUTES['GET /reglages']), {}],
      sessions: [nomRoute(ROUTES['GET /sessions']), {}],
    }
    for (const cle of Object.values(cles)) client.setQueryData(cle, { ok: true })
    await invaliderApprentissage(client)
    const perimee = (cle: unknown[]) => client.getQueryState(cle)?.isInvalidated
    expect(perimee(cles.tableau)).toBe(true)
    expect(perimee(cles.jour)).toBe(true)
    expect(perimee(cles.bloc)).toBe(true)
    expect(perimee(cles.reglages)).toBe(false)
    expect(perimee(cles.sessions)).toBe(false)
  })
})
