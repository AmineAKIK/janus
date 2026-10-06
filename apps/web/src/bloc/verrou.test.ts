import { describe, expect, it } from 'vitest'
import { etapesVerrouillees, questionsRestantes } from './verrou.ts'

const ETAPES = [
  { id: 'ET1', type: 'carte' },
  { id: 'ET2', type: 'explication' },
  { id: 'ET3', type: 'pratique' },
  { id: 'ET4', type: 'restitution' },
  { id: 'ET5', type: 'consolidation' },
  { id: 'ET6', type: 'bilan' },
] as const

describe('questionsRestantes', () => {
  const QUESTIONS = ['R1', 'R2', 'R3']

  it('restitution : le serveur dit ce qui reste, moins ce que la page vient d’envoyer', () => {
    const manque = [{ code: 'restitution_incomplete' as const, questions: ['R2', 'R3'] }]

    expect(questionsRestantes('restitution', QUESTIONS, [], manque)).toEqual(['R2', 'R3'])
    expect(questionsRestantes('restitution', QUESTIONS, ['R2'], manque)).toEqual(['R3'])
    expect(questionsRestantes('restitution', QUESTIONS, ['R2', 'R3'], manque)).toEqual([])
  })

  it('restitution : sans manque « restitution_incomplete », la série est complète', () => {
    expect(questionsRestantes('restitution', QUESTIONS, [], [])).toEqual([])
  })

  it('restitution : un manque sans liste veut dire toutes les questions', () => {
    const manque = [{ code: 'restitution_incomplete' as const }]

    expect(questionsRestantes('restitution', QUESTIONS, ['R1'], manque)).toEqual(['R2', 'R3'])
  })

  it('consolidation : compte les questions de la série non envoyées', () => {
    expect(questionsRestantes('consolidation', ['C1', 'C2'], ['C1'], [])).toEqual(['C2'])
    expect(questionsRestantes('consolidation', ['C1'], ['C1'], [])).toEqual([])
  })
})

describe('etapesVerrouillees', () => {
  const restantes = (restitution: number, consolidation = 0) => ({ restitution, consolidation })

  it('verrouille les étapes de cours pendant une série pas finie', () => {
    expect(etapesVerrouillees(ETAPES, 'ET4', restantes(2))).toEqual(new Set(['ET1', 'ET2', 'ET3']))
    expect(etapesVerrouillees(ETAPES, 'ET5', restantes(0, 1))).toEqual(
      new Set(['ET1', 'ET2', 'ET3']),
    )
  })

  it('ne verrouille rien quand la série de l’étape courante est complète', () => {
    expect(etapesVerrouillees(ETAPES, 'ET4', restantes(0, 3))).toEqual(new Set())
  })

  it('ne verrouille rien hors restitution et consolidation', () => {
    expect(etapesVerrouillees(ETAPES, 'ET2', restantes(3, 3))).toEqual(new Set())
    expect(etapesVerrouillees(ETAPES, 'ET6', restantes(3, 3))).toEqual(new Set())
    expect(etapesVerrouillees(ETAPES, null, restantes(3, 3))).toEqual(new Set())
  })
})
