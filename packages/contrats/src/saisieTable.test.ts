import { describe, expect, it } from 'vitest'
import { Manifeste } from './manifeste.ts'
import { casDeLaTable, lectureDeLaTable, modeleDeLigne, texteDeLaTable } from './saisieTable.ts'

const GRILLE = { type: 'table', entrees: ['A', 'B'], colonnes: ['NON B', 'A OU NON B'] } as const

describe('la table de vérité à remplir', () => {
  it('range les cas comme on compte en binaire, le premier fait changeant le moins souvent', () => {
    expect(casDeLaTable(['A', 'B'])).toEqual([
      [false, false],
      [false, true],
      [true, false],
      [true, true],
    ])
    expect(casDeLaTable(['A', 'B', 'C'])).toHaveLength(8)
    expect(casDeLaTable(['A', 'B', 'C'])[3]).toEqual([false, true, true])
  })

  it('écrit la réponse une ligne par cas, sans rien à deviner', () => {
    expect(
      texteDeLaTable(GRILLE, [
        [true, true],
        [false, false],
        [true, true],
        [false, true],
      ]),
    ).toBe(
      [
        'A FAUX, B FAUX : NON B VRAI ; A OU NON B VRAI',
        'A FAUX, B VRAI : NON B FAUX ; A OU NON B FAUX',
        'A VRAI, B FAUX : NON B VRAI ; A OU NON B VRAI',
        'A VRAI, B VRAI : NON B FAUX ; A OU NON B VRAI',
      ].join('\n'),
    )
  })

  it('se dit en une phrase, et donne la forme d’une ligne à qui répond en texte', () => {
    expect(lectureDeLaTable(GRILLE)).toBe(
      'Une table à remplir, une ligne par cas, de A FAUX, B FAUX à A VRAI, B VRAI. Pour chaque ligne, choisis VRAI ou FAUX pour NON B, puis pour A OU NON B.',
    )
    expect(modeleDeLigne(GRILLE)).toBe(
      'A FAUX, B FAUX : NON B VRAI ou FAUX ; A OU NON B VRAI ou FAUX',
    )
  })

  it('ne se déclare qu’en restitution', () => {
    const question = { id: 'Q1', question: 'Q ?', attendu: 'A.', erreurs: [], saisie: GRILLE }
    const forme = Manifeste.shape
    expect(forme.restitution.safeParse([question]).success).toBe(true)
    expect(forme.rappel.safeParse([question]).success).toBe(false)
    expect(
      forme.restitution.safeParse([{ ...question, saisie: { ...GRILLE, colonnes: [] } }]).success,
    ).toBe(false)
  })
})
