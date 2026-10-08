import { Reglages } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import type { Fait } from '../faits.ts'
import { ECHANTILLONS_RECENTS, fiabilite } from './fiabilite.ts'
import type { ControleCorrection } from './fiabilite.ts'

const REGLAGES = Reglages.parse({})
const MAINTENANT = '2026-10-15T10:00:00Z'

const controle = (
  date: string,
  accord: boolean | null,
  options: Partial<ControleCorrection> = {},
): ControleCorrection => ({ date, echantillon: true, nonVerifiee: false, accord, ...options })

const contestation = (id: string, date: string): Fait => ({
  id,
  bloc: 'B01',
  date,
  type: 'correction_contestee',
  correction: 'c1',
})

describe('fiabilite', () => {
  it('rend zéro et aucune alerte sans rien', () => {
    expect(fiabilite([], [], 'tout', MAINTENANT, REGLAGES)).toEqual({
      copiesRelues: 0,
      desaccords: 0,
      nonVerifiees: 0,
      contestations: 0,
      alerte: false,
    })
  })

  it('compte les copies relues, les désaccords, les réponses non vérifiées et les contestations', () => {
    const controles = [
      controle('2026-10-10T10:00:00Z', true),
      controle('2026-10-11T10:00:00Z', false),
      // Pas encore répondu : pas une copie relue.
      controle('2026-10-12T10:00:00Z', null),
      // Hors échantillon : un avis donné ailleurs ne compte pas ici.
      controle('2026-10-13T10:00:00Z', false, { echantillon: false }),
      controle('2026-10-13T11:00:00Z', null, { echantillon: false, nonVerifiee: true }),
      controle('2026-10-14T10:00:00Z', true, { nonVerifiee: true }),
    ]
    const faits = [
      contestation('x1', '2026-10-12T10:00:00Z'),
      contestation('x2', '2026-10-13T10:00:00Z'),
    ]
    expect(fiabilite(controles, faits, 'tout', MAINTENANT, REGLAGES)).toMatchObject({
      copiesRelues: 3,
      desaccords: 1,
      nonVerifiees: 2,
      contestations: 2,
    })
  })

  it('garde la période pour les comptes', () => {
    const controles = [
      controle('2026-08-01T10:00:00Z', false),
      controle('2026-10-14T10:00:00Z', true),
    ]
    const faits = [contestation('x1', '2026-08-01T10:00:00Z')]
    expect(fiabilite(controles, faits, '7j', MAINTENANT, REGLAGES)).toMatchObject({
      copiesRelues: 1,
      desaccords: 0,
      contestations: 0,
    })
  })

  it('alerte au-delà de 15 % de désaccord, pas à 15 % pile', () => {
    const jour = (rang: number) => `2026-09-${String(10 + rang)}T10:00:00Z`
    const sur20 = (desaccords: number) =>
      Array.from({ length: 20 }, (_, rang) => controle(jour(rang), rang >= desaccords))
    // 3 sur 20 = 15 % : pas d'alerte ; 4 sur 20 = 20 % : alerte.
    expect(fiabilite(sur20(3), [], 'tout', MAINTENANT, REGLAGES).alerte).toBe(false)
    expect(fiabilite(sur20(4), [], 'tout', MAINTENANT, REGLAGES).alerte).toBe(true)
  })

  it('ne regarde que les 30 derniers échantillons, quelle que soit la période', () => {
    const anciens = Array.from({ length: 10 }, (_, rang) =>
      controle(`2026-06-${String(10 + rang)}T10:00:00Z`, false),
    )
    const recents = Array.from({ length: ECHANTILLONS_RECENTS }, (_, rang) =>
      controle(`2026-09-${String(1 + rang).padStart(2, '0')}T10:00:00Z`, true),
    )
    const mesure = fiabilite([...anciens, ...recents], [], '7j', MAINTENANT, REGLAGES)
    expect(mesure.alerte).toBe(false)
    expect(mesure.copiesRelues).toBe(0)
  })
})
