import { ROUTES } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import { monterDemo } from './banc.ts'

const ID = '0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b'

describe('questions de début de séance de la démo', () => {
  it('rend la série du jour sans nommer le bloc, la même à chaque lecture', async () => {
    const { transport } = monterDemo()

    const premiere = await transport.appeler(ROUTES['GET /questions-debut'], {})
    const seconde = await transport.appeler(ROUTES['GET /questions-debut'], {})

    expect(premiere.questions.length).toBeGreaterThan(0)
    expect(premiere.questions.every(({ deja }) => deja === null)).toBe(true)
    expect(JSON.stringify(premiere)).not.toMatch(/"bloc"/)
    expect(seconde).toEqual(premiere)
  })

  it('corrige une question de début de séance et retient la réponse pour reprendre', async () => {
    const { transport } = monterDemo()
    const { questions } = await transport.appeler(ROUTES['GET /questions-debut'], {})
    const question = questions[0]
    if (question === undefined) throw new Error('Aucune question')

    const recue = await transport.appeler(ROUTES['POST /corrections'], {
      corps: {
        id: ID,
        serie: 'rappel',
        tentative: 1,
        question: question.id,
        reponse: 'Je ne sais pas',
        confiance: 'hasard',
        relance: '',
        support: { colle: false, retour_cours: false },
      },
    })
    const apres = await transport.appeler(ROUTES['GET /questions-debut'], {})

    expect(recue.question).toBe(question.id)
    const reprise = apres.questions.find(({ id }) => id === question.id)
    expect(reprise?.deja).toMatchObject({
      confiance: 'hasard',
      reponse: 'Je ne sais pas',
      correction: { id: ID },
    })
    expect(apres.questions.filter(({ deja }) => deja !== null)).toHaveLength(1)
  })

  it('refuse une question qui n’est pas dans la série du jour', async () => {
    const { transport } = monterDemo()

    await expect(
      transport.appeler(ROUTES['POST /corrections'], {
        corps: {
          id: ID,
          serie: 'rappel',
          tentative: 1,
          question: 'inconnue',
          reponse: 'x',
          confiance: 'sur',
          relance: '',
          support: { colle: false, retour_cours: false },
        },
      }),
    ).rejects.toMatchObject({ status: 404 })
  })
})
