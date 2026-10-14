import { describe, expect, it } from 'vitest'
import { creerFaux } from '../../adaptateurs/correcteur/faux.ts'
import { creerBase } from '../../base/base.ts'
import { ErreurConfig } from '../../config.ts'
import { configDeTest, horlogeFausse } from '../../testeur.ts'
import { monterCorrection } from './composition.ts'

// Une connexion paresseuse qui ne s'ouvre jamais : brancher la correction ne touche pas la base.
const base = creerBase('postgres://janus@localhost/janus_factice')
const dependances = { base, proprietaire: base, horloge: horlogeFausse() }

describe('monterCorrection', () => {
  it('refuse de démarrer quand le correcteur configuré n’a pas sa clé', () => {
    const sansCle = () => monterCorrection({ ...dependances, config: configDeTest() })
    expect(sansCle).toThrow(ErreurConfig)
    expect(sansCle).toThrow(/« claude ».*ANTHROPIC_API_KEY/)

    const secoursSansCle = () =>
      monterCorrection({ ...dependances, config: configDeTest({ CORRECTEUR: 'deepseek' }) })
    expect(secoursSansCle).toThrow(/« deepseek ».*DEEPSEEK_API_KEY/)
  })

  it('démarre avec la clé du correcteur configuré', () => {
    expect(() =>
      monterCorrection({
        ...dependances,
        config: configDeTest({ ANTHROPIC_API_KEY: 'cle-de-test' }),
      }),
    ).not.toThrow()
    expect(() =>
      monterCorrection({
        ...dependances,
        config: configDeTest({ CORRECTEUR: 'deepseek', DEEPSEEK_API_KEY: 'cle-de-test' }),
      }),
    ).not.toThrow()
  })

  it('démarre avec un correcteur injecté, même sans clé (tests, banc)', () => {
    expect(() =>
      monterCorrection({ ...dependances, config: configDeTest(), correcteur: creerFaux() }),
    ).not.toThrow()
  })
})
