import { ROUTES } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import { monterDemo } from './banc.ts'

describe('réglages de la démo', () => {
  it('change seulement les réglages envoyés', async () => {
    const { transport } = monterDemo()

    const apres = await transport.appeler(ROUTES['PATCH /reglages'], {
      corps: { questionsDebut: 8 },
    })

    expect(apres.questionsDebut).toBe(8)
    expect(apres.nouvellesCartesParJour).toBe(20)
    expect(await transport.appeler(ROUTES['GET /reglages'], {})).toEqual(apres)
  })

  it('refuse une valeur hors bornes', async () => {
    const { transport } = monterDemo()

    await expect(
      transport.appeler(ROUTES['PATCH /reglages'], { corps: { questionsDebut: 3 } }),
    ).rejects.toBeTruthy()
  })

  it('« questions de début à 8 » donne des séries de 8 questions', async () => {
    const { transport } = monterDemo()
    const avant = await transport.appeler(ROUTES['GET /questions-debut'], {})

    await transport.appeler(ROUTES['PATCH /reglages'], { corps: { questionsDebut: 8 } })
    const apres = await transport.appeler(ROUTES['GET /questions-debut'], {})

    expect(avant.questions).toHaveLength(6)
    expect(apres.questions).toHaveLength(8)
  })
})
