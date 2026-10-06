import { ROUTES } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import { monterDemo } from './banc.ts'

const ID = '0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b'

describe('cartes de la démo', () => {
  it('rend les nouvelles cartes des blocs vus avec l’aperçu de leurs quatre intervalles', async () => {
    const { transport } = monterDemo()

    const { dues, nouvelles, prochaine } = await transport.appeler(ROUTES['GET /cartes/dues'], {})

    expect(dues).toEqual([])
    expect(nouvelles.length).toBeGreaterThan(0)
    expect(nouvelles.every(({ nouvelle }) => nouvelle)).toBe(true)
    const apercu = nouvelles[0]?.apercu
    expect(apercu?.a_revoir).toBeLessThan(apercu?.bien ?? 0)
    expect(apercu?.bien).toBeLessThan(apercu?.facile ?? 0)
    expect(prochaine).toBeNull()
  })

  it('une note programme la carte : elle sort de la file et revient à l’échéance rendue', async () => {
    const { transport } = monterDemo()
    const { nouvelles } = await transport.appeler(ROUTES['GET /cartes/dues'], {})
    const carte = nouvelles[0]
    if (carte === undefined) throw new Error('Aucune carte')

    const { echeance } = await transport.appeler(ROUTES['POST /cartes/:id/note'], {
      params: { id: carte.id },
      corps: { id: ID, note: 'bien' },
    })
    const apres = await transport.appeler(ROUTES['GET /cartes/dues'], {})

    expect([...apres.dues, ...apres.nouvelles].some(({ id }) => id === carte.id)).toBe(false)
    expect(apres.prochaine).toBe(echeance)
  })

  it('une note rejouée avec le même identifiant ne change rien', async () => {
    const { transport, magasin } = monterDemo()
    const { nouvelles } = await transport.appeler(ROUTES['GET /cartes/dues'], {})
    const carte = nouvelles[0]
    if (carte === undefined) throw new Error('Aucune carte')
    const note = { params: { id: carte.id }, corps: { id: ID, note: 'facile' as const } }

    await transport.appeler(ROUTES['POST /cartes/:id/note'], note)
    const premier = magasin.lire().cartes
    await transport.appeler(ROUTES['POST /cartes/:id/note'], note)

    expect(magasin.lire().cartes).toEqual(premier)
  })

  it('refuse une carte inconnue', async () => {
    const { transport } = monterDemo()

    await expect(
      transport.appeler(ROUTES['POST /cartes/:id/note'], {
        params: { id: 'B03:inconnue' },
        corps: { id: ID, note: 'bien' },
      }),
    ).rejects.toMatchObject({ status: 404 })
  })
})
