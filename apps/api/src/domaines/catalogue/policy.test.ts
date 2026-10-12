import { describe, expect, it } from 'vitest'
import { peutOuvrir } from './policy.ts'

describe('peutOuvrir', () => {
  it.each([
    ['libre', false, undefined, true],
    ['libre', true, 'je veux voir', true],
    ['raison_requise', false, undefined, false],
    ['raison_requise', false, 'une raison', false],
    ['raison_requise', true, undefined, false],
    ['raison_requise', true, 'je connais déjà ce sujet', true],
  ] as const)(
    'accès %s, hors prérequis %s, raison %s : %s',
    (acces, horsPrerequis, raison, attendu) => {
      expect(peutOuvrir(acces, { horsPrerequis, raison })).toBe(attendu)
    },
  )
})
