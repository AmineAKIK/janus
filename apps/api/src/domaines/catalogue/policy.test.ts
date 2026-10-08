import type { Statut } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import { peutOuvrir, serieOuverte } from './policy.ts'

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

describe('serieOuverte', () => {
  const statuts: [Statut, boolean, boolean, boolean][] = [
    ['non_commence', false, true, false],
    ['en_cours', false, true, false],
    ['a_reprendre', false, true, false],
    ['vu', false, false, true],
    ['vu', true, false, false],
    ['acquis_provisoirement', false, false, true],
    ['acquis_provisoirement', true, false, false],
    ['acquis', false, false, false],
    ['maitrise', false, false, false],
  ]

  it.each(statuts)(
    'statut %s, consolidation trop tôt %s',
    (statut, tropTot, restitution, consolidation) => {
      expect(serieOuverte(statut, tropTot)).toEqual({ restitution, consolidation })
    },
  )
})
