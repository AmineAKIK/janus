import type { Differee } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import { corrigerTache } from './verification.ts'

const SUPPORT = { colle: false, retour_cours: false }
const exacte: Differee = {
  id: 'DT1',
  type: 'tache',
  consigne: 'Écris FICHE.',
  attendu: 'FICHE',
  erreurs: [],
  verification: { mode: 'exacte', reponses: ['FICHE', 'Fiche'] },
}
const code: Differee = {
  id: 'DT3',
  type: 'tache',
  consigne: 'Écris une fonction.',
  attendu: 'double',
  erreurs: [],
  verification: {
    mode: 'code',
    langage: 'js',
    cas: [
      { entree: [1], sortie: 2 },
      { entree: [2], sortie: 4 },
    ],
  },
}

describe('corrigerTache', () => {
  it('accepte une des réponses exactes, et dit l’attendu sinon', () => {
    expect(corrigerTache(exacte, { reponse: ' Fiche ', support: SUPPORT })).toMatchObject({
      reussi: true,
      compte: true,
    })
    expect(corrigerTache(exacte, { reponse: 'fiche', support: SUPPORT })).toMatchObject({
      reussi: false,
      correction: 'Attendu : FICHE',
    })
  })

  it('ne compte pas une réponse collée', () => {
    expect(
      corrigerTache(exacte, { reponse: 'FICHE', support: { colle: true, retour_cours: false } })
        ?.compte,
    ).toBe(false)
  })

  it('exige le résultat des cas pour une tâche de code, tous réussis et au moins ceux du manifeste', () => {
    expect(corrigerTache(code, { reponse: 'x', support: SUPPORT })).toBeUndefined()
    expect(
      corrigerTache(code, { reponse: 'x', support: SUPPORT, code: { reussis: 2, total: 2 } }),
    ).toMatchObject({ reussi: true, cas: { reussis: 2, total: 2 } })
    expect(
      corrigerTache(code, { reponse: 'x', support: SUPPORT, code: { reussis: 1, total: 2 } })
        ?.reussi,
    ).toBe(false)
    expect(
      corrigerTache(code, { reponse: 'x', support: SUPPORT, code: { reussis: 1, total: 1 } })
        ?.reussi,
    ).toBe(false)
  })
})
