import { ROUTES } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import { monterDemo } from './banc.ts'

const ID = (n: number) => `0190a000-0000-7000-8000-${n.toString(16).padStart(12, '0')}`

const cocher = (transport: ReturnType<typeof monterDemo>['transport'], n: number, ids: string[]) =>
  transport.appeler(ROUTES['POST /evenements'], {
    corps: {
      id: ID(n),
      type: 'bilan.erreurs',
      bloc: 'B03',
      version: 1,
      t: '2026-06-01T12:00:00+02:00',
      ids,
    },
  })

describe('bilan.erreurs de la démo', () => {
  it('ouvre les erreurs cochées et rend le statut recalculé', async () => {
    const { transport } = monterDemo()

    const reponse = await cocher(transport, 1, ['E1'])

    expect(reponse.statut?.erreurs_ouvertes).toEqual(['E1'])
  })

  it('l’état complet fait foi : une erreur décochée se referme', async () => {
    const { transport } = monterDemo()
    await cocher(transport, 1, ['E1', 'E2'])

    const reponse = await cocher(transport, 2, ['E2'])

    expect(reponse.statut?.erreurs_ouvertes).toEqual(['E2'])
  })

  it('ne compte pas deux fois une demande déjà reçue', async () => {
    const { transport, magasin } = monterDemo()
    await cocher(transport, 1, ['E1'])
    const avant = magasin.lire().faits.length

    await cocher(transport, 1, ['E1'])

    expect(magasin.lire().faits).toHaveLength(avant)
  })

  it('répond 404 pour un bloc inconnu', async () => {
    const { transport } = monterDemo()

    await expect(
      transport.appeler(ROUTES['POST /evenements'], {
        corps: {
          id: ID(1),
          type: 'bilan.erreurs',
          bloc: 'Z99',
          version: 1,
          t: '2026-06-01T12:00:00+02:00',
          ids: [],
        },
      }),
    ).rejects.toMatchObject({ status: 404 })
  })
})
