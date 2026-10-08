import { describe, expect, it } from 'vitest'
import { serveurDeTest } from '../../testeur.ts'

describe('GET /api/sante', () => {
  it('rend 200 { ok: true, base: true } quand SELECT 1 répond, sans être connecté', async () => {
    const { app, base } = await serveurDeTest()

    const reponse = await app.inject({ method: 'GET', url: '/api/sante' })

    expect(reponse.statusCode).toBe(200)
    expect(reponse.json()).toEqual({ ok: true, base: true })
    expect(base.requetes).toEqual(['SELECT 1'])
  })

  it('rend 503 quand la base ne répond pas', async () => {
    const { app } = await serveurDeTest({ baseRepond: false })

    const reponse = await app.inject({ method: 'GET', url: '/api/sante' })

    expect(reponse.statusCode).toBe(503)
    expect(reponse.json()).toEqual({ ok: false, base: false })
  })
})
