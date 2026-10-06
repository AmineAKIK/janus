import type { Manque } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import { ligneEcheance } from './echeance.ts'
import type { EntreeEcheance } from './echeance.ts'

function entree(surcharge: Partial<EntreeEcheance> = {}): EntreeEcheance {
  return {
    statut: 'non_commence',
    manque: [],
    erreursOuvertes: [],
    etape: null,
    prerequisManquants: [],
    aujourdhui: '2026-10-05',
    enJour: (date) => date.slice(0, 10),
    ...surcharge,
  }
}

const manque = (code: Manque['code'], apres?: string): Manque =>
  apres === undefined ? { code } : { code, apres }

describe('ligneEcheance, dans l’ordre des priorités', () => {
  it('1. une erreur ouverte : son libellé et « à reprendre », avant tout le reste', () => {
    const ligne = ligneEcheance(
      entree({
        erreursOuvertes: ['Confond compilateur et interpréteur'],
        manque: [manque('verification_a_faire', '2026-10-05')],
        etape: { rang: 3, total: 8 },
        prerequisManquants: ['B03'],
      }),
    )

    expect(ligne).toEqual({
      date: 'à reprendre',
      erreur: 'Confond compilateur et interpréteur',
      prerequis: null,
    })
  })

  it('2. une vérification due aujourd’hui', () => {
    const ligne = ligneEcheance(
      entree({
        manque: [manque('verification_a_faire', '2026-10-05')],
        etape: { rang: 1, total: 2 },
      }),
    )

    expect(ligne.date).toBe('vérification aujourd’hui')
  })

  it('2. une vérification en retard compte comme due aujourd’hui', () => {
    expect(
      ligneEcheance(entree({ manque: [manque('verification_a_faire', '2026-10-01')] })).date,
    ).toBe('vérification aujourd’hui')
  })

  it('2. une vérification à venir, demain ou plus tard', () => {
    expect(
      ligneEcheance(entree({ manque: [manque('verification_a_venir', '2026-10-06')] })).date,
    ).toBe('vérification demain')
    expect(
      ligneEcheance(entree({ manque: [manque('verification_a_venir', '2026-10-07')] })).date,
    ).toBe('vérification le 7 oct.')
  })

  it('2. un retest, avec sa date', () => {
    expect(ligneEcheance(entree({ manque: [manque('retest_a_venir', '2026-11-01')] })).date).toBe(
      'retest le 1 nov.',
    )
    expect(ligneEcheance(entree({ manque: [manque('retest_a_faire', '2026-10-05')] })).date).toBe(
      'retest aujourd’hui',
    )
  })

  it('3. une consolidation en attente ou à faire', () => {
    expect(
      ligneEcheance(entree({ manque: [manque('consolidation_trop_tot', '2026-10-06T08:00:00Z')] }))
        .date,
    ).toBe('consolidation demain')
    expect(ligneEcheance(entree({ manque: [manque('consolidation_a_faire')] })).date).toBe(
      'consolidation à faire',
    )
  })

  it('4. une restitution à faire, pour un bloc en cours ou vu', () => {
    const restitution = [manque('restitution_incomplete')]

    expect(ligneEcheance(entree({ statut: 'en_cours', manque: restitution })).date).toBe(
      'restitution à faire',
    )
    expect(ligneEcheance(entree({ statut: 'vu', manque: restitution })).date).toBe(
      'restitution à faire',
    )
  })

  it('4. pas de restitution à annoncer pour un bloc pas commencé', () => {
    expect(
      ligneEcheance(entree({ statut: 'non_commence', manque: [manque('restitution_incomplete')] })),
    ).toEqual({ date: null, erreur: null, prerequis: null })
  })

  it('5. l’étape en cours', () => {
    expect(ligneEcheance(entree({ statut: 'en_cours', etape: { rang: 3, total: 8 } })).date).toBe(
      'étape 3 sur 8',
    )
  })

  it('6. le prérequis manquant', () => {
    expect(ligneEcheance(entree({ prerequisManquants: ['B03', 'B05'] }))).toEqual({
      date: null,
      erreur: null,
      prerequis: 'prérequis : B03, B05',
    })
  })

  it('7. sinon rien', () => {
    expect(ligneEcheance(entree())).toEqual({ date: null, erreur: null, prerequis: null })
  })
})
