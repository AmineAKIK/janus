import { Reglages } from '@janus/contrats'
import type { Niveau, ReponseVerification } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import type { Fait } from '../faits.ts'
import { retention } from './retention.ts'
import type { RevueCarte } from './retention.ts'

const REGLAGES = Reglages.parse({})
const MAINTENANT = '2026-10-15T10:00:00Z'

let numero = 0
const id = () => `f${String((numero += 1))}`
const question = (
  date: string,
  niveau: Niveau,
  options: { tour?: number; serie?: 'rappel' | 'restitution' } = {},
): Fait => ({
  id: id(),
  bloc: 'B01',
  date,
  type: 'correction',
  serie: options.serie ?? 'rappel',
  question: 'Q',
  tour: options.tour ?? 1,
  niveau,
  compte: true,
  confiance: 'sur',
  erreursIa: [],
})
const tache = (
  reussi: boolean,
  options: { compte?: boolean; tour?: number } = {},
): ReponseVerification => ({
  type: 'tache',
  question: 'T',
  tour: options.tour ?? 1,
  compte: options.compte ?? true,
  reussi,
})
const verification = (date: string, reponses: ReponseVerification[], valable = true): Fait => ({
  id: id(),
  bloc: 'B01',
  date,
  type: 'verification_terminee',
  verification: 'verification',
  valable,
  reponses,
})
const carte = (date: string, note: RevueCarte['note']): RevueCarte => ({ date, note })

describe('retention', () => {
  const faits: Fait[] = [
    // Il y a 3 semaines : 1 question solide sur 2, hors rappel et second tour ignorés.
    question('2026-09-22T10:00:00Z', 'solide'),
    question('2026-09-23T10:00:00Z', 'fragile'),
    question('2026-09-23T11:00:00Z', 'solide', { serie: 'restitution' }),
    question('2026-09-23T12:00:00Z', 'solide', { tour: 2 }),
    // Semaine du 28 septembre : une vérification réussie et une ratée.
    verification('2026-10-01T10:00:00Z', [tache(true), tache(true)]),
    verification('2026-10-02T10:00:00Z', [tache(true), tache(false)]),
    // Invalide et sans réponse comptée : ne comptent pas. Un échec au second tour est ignoré : réussie.
    verification('2026-10-02T11:00:00Z', [tache(false)], false),
    verification('2026-10-02T12:00:00Z', [tache(false, { compte: false })]),
    verification('2026-10-02T13:00:00Z', [tache(true), tache(false, { tour: 2 })]),
    // Une explication solide compte comme réussie ; un transfert fragile non.
    verification('2026-10-13T10:00:00Z', [
      { type: 'explication', question: 'E', tour: 1, compte: true, niveau: 'solide' },
      { type: 'transfert', question: 'X', tour: 1, compte: true, niveau: 'fragile' },
    ]),
    // Hors fenêtre.
    question('2026-08-01T10:00:00Z', 'solide'),
    { id: 'x', bloc: 'B01', date: '2026-10-13T10:00:00Z', type: 'force_levee' },
  ]
  const revues = [
    carte('2026-09-29T10:00:00Z', 'bien'),
    carte('2026-09-29T11:00:00Z', 'a_revoir'),
    carte('2026-09-30T10:00:00Z', 'facile'),
    carte('2026-10-14T10:00:00Z', 'difficile'),
    carte('2026-07-01T10:00:00Z', 'bien'),
  ]

  it('compte, semaine par semaine, cartes, questions de début et vérifications', () => {
    expect(retention(faits, revues, MAINTENANT, REGLAGES)).toEqual([
      {
        debut: '2026-09-21',
        cartes: { reussis: 0, total: 0 },
        questions: { reussis: 1, total: 2 },
        verifications: { reussis: 0, total: 0 },
      },
      {
        debut: '2026-09-28',
        cartes: { reussis: 2, total: 3 },
        questions: { reussis: 0, total: 0 },
        verifications: { reussis: 2, total: 3 },
      },
      {
        debut: '2026-10-05',
        cartes: { reussis: 0, total: 0 },
        questions: { reussis: 0, total: 0 },
        verifications: { reussis: 0, total: 0 },
      },
      {
        debut: '2026-10-12',
        cartes: { reussis: 1, total: 1 },
        questions: { reussis: 0, total: 0 },
        verifications: { reussis: 0, total: 1 },
      },
    ])
  })

  it('rend 4 semaines à zéro sans rien', () => {
    const semaines = retention([], [], MAINTENANT, REGLAGES)
    expect(semaines).toHaveLength(4)
    expect(semaines.every(({ cartes, questions }) => cartes.total + questions.total === 0)).toBe(
      true,
    )
  })
})
