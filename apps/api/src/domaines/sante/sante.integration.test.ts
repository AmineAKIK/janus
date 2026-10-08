import { describe, expect, it } from 'vitest'
import { creerBase } from '../../base/base.ts'
import { creerServeur } from '../../serveur.ts'
import { configDeTest } from '../../testeur.ts'
import { horlogeSysteme } from '../../horloge.ts'

// Contre un vrai PostgreSQL : la CI fournit `DATABASE_URL` (service postgres:17).
const url = process.env['DATABASE_URL']

describe.skipIf(url === undefined)('GET /api/sante contre PostgreSQL', () => {
  it('rend 200 avec une vraie base, puis 503 une fois la connexion fermée', async () => {
    const base = creerBase(url ?? '')
    const app = await creerServeur({
      config: configDeTest({ NIVEAU_JOURNAL: 'silent' }),
      horloge: horlogeSysteme,
      base,
      proprietaire: base,
    })

    const vivante = await app.inject({ method: 'GET', url: '/api/sante' })
    expect(vivante.statusCode).toBe(200)
    expect(vivante.json()).toEqual({ ok: true, base: true })

    await base.fermer()
    const coupee = await app.inject({ method: 'GET', url: '/api/sante' })
    expect(coupee.statusCode).toBe(503)
    expect(coupee.json()).toEqual({ ok: false, base: false })
  })
})
