import type { CinqPreuves } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import { lignesPreuves } from './preuves.ts'

const AUJOURDHUI = '2026-10-05'
const enJour = (date: string) => date.slice(0, 10)
const VIDE: CinqPreuves = {
  comprendre: null,
  faire_seul: null,
  transferer: null,
  retenir: null,
  aisance: null,
}
const textes = (preuves: CinqPreuves) =>
  lignesPreuves(preuves, AUJOURDHUI, enJour).map(({ libelle, texte }) => `${libelle} : ${texte}`)

describe('lignesPreuves', () => {
  it('annonce « Pas encore » tant qu’aucune preuve n’est faite', () => {
    expect(textes(VIDE)).toEqual([
      'Comprendre : Pas encore',
      'Faire seul : Pas encore',
      'Transférer : Pas encore',
      'Retenir : Pas encore',
      'Aisance : Pas encore',
    ])
  })

  it('date les preuves faites et annonce la prochaine échéance de « Retenir »', () => {
    const lignes = textes({
      ...VIDE,
      comprendre: { date: '2026-10-01T09:00:00Z' },
      retenir: {
        date: '2026-10-02T09:00:00Z',
        prochaine: { type: 'retest', apres: '2026-11-01' },
      },
      aisance: 'non_requis',
    })

    expect(lignes[0]).toBe('Comprendre : Prouvé le 1 oct.')
    expect(lignes[3]).toBe('Retenir : Prouvé le 2 oct. · retest le 1 nov.')
    expect(lignes[4]).toBe('Aisance : Non requis')
  })

  it('dit « aujourd’hui » et « demain » sans « le »', () => {
    const lignes = textes({
      ...VIDE,
      faire_seul: { date: '2026-10-05T08:00:00Z' },
      retenir: {
        date: '2026-10-05T08:00:00Z',
        prochaine: { type: 'verification', apres: '2026-10-06' },
      },
    })

    expect(lignes[1]).toBe('Faire seul : Prouvé aujourd’hui')
    expect(lignes[3]).toBe('Retenir : Prouvé aujourd’hui · vérification demain')
  })
})
