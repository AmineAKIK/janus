import { describe, expect, it } from 'vitest'
import { serialiserErreur } from './serialiseurErreur.ts'

const journaliser = (erreur: unknown): string => JSON.stringify({ err: serialiserErreur(erreur) })

describe('serialiserErreur', () => {
  it('ne journalise ni la requête ni les paramètres d’une requête SQL en échec', () => {
    const cause = Object.assign(new Error('duplicate key value'), { code: '23505' })
    const erreur = new Error(
      'Failed query: insert into "evenements" values ($1, $2)\nparams: ma réponse perso,hash$2b$12$abc',
      { cause },
    )

    const ligne = journaliser(erreur)

    expect(ligne).not.toContain('ma réponse perso')
    expect(ligne).not.toContain('hash$2b$12')
    expect(ligne).not.toContain('Failed query')
    expect(ligne).toContain('"code":"23505"')
    expect(ligne).toContain('"type":"Error"')
    expect(ligne).toContain('duplicate key value')
  })

  it('ne garde rien du message d’une requête en échec dont la cause n’est pas une erreur', () => {
    const ligne = journaliser(new Error('Failed query: select 1\nparams: secret', { cause: 'x' }))

    expect(ligne).not.toContain('secret')
  })

  it('garde les cadres de la pile pour retrouver l’endroit', () => {
    const ligne = journaliser(new Error('panne'))

    expect(ligne).toContain('serialiseurErreur.test.ts')
    expect(ligne).toContain('panne')
  })

  it('accepte ce qui n’est pas une erreur', () => {
    expect(serialiserErreur('texte')).toEqual({ type: 'string', message: '', stack: '' })
  })
})
