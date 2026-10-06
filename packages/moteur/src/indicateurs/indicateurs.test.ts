import { Reglages } from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import type { Fait } from '../faits.ts'
import {
  blocsOuvertsSansPrerequis,
  budgetEnAlerte,
  carteDuModule,
  dansLaPeriode,
  depenseDuMois,
  erreursRecurrentes,
  ouverturesSansPrerequis,
  partDuBudget,
  statutsForces,
} from './index.ts'

const REGLAGES = Reglages.parse({})
const MAINTENANT = '2026-10-15T10:00:00.000Z'
const il_y_a = (jours: number) =>
  new Date(Date.parse(MAINTENANT) - jours * 86_400_000).toISOString()

let compteur = 0
const commun = (bloc: string, jours: number) => ({
  id: `f${String((compteur += 1))}`,
  bloc,
  date: il_y_a(jours),
})
const cochee = (bloc: string, erreur: string, jours: number): Fait => ({
  ...commun(bloc, jours),
  type: 'erreur_cochee',
  erreur,
  source: 'amine',
})
const ouvert = (bloc: string, jours: number, horsPrerequis: boolean, raison?: string): Fait => ({
  ...commun(bloc, jours),
  type: 'bloc_ouvert',
  horsPrerequis,
  ...(raison === undefined ? {} : { raison }),
})
const force = (bloc: string, jours: number): Fait => ({
  ...commun(bloc, jours),
  type: 'statut_force',
  statut: 'vu',
  raison: 'Je l’ai vu en cours.',
})

describe('dansLaPeriode', () => {
  it('garde les N derniers jours, le jour courant compris, ou tout', () => {
    expect(dansLaPeriode(il_y_a(0), '7j', MAINTENANT, REGLAGES)).toBe(true)
    expect(dansLaPeriode(il_y_a(6), '7j', MAINTENANT, REGLAGES)).toBe(true)
    expect(dansLaPeriode(il_y_a(7), '7j', MAINTENANT, REGLAGES)).toBe(false)
    expect(dansLaPeriode(il_y_a(29), '30j', MAINTENANT, REGLAGES)).toBe(true)
    expect(dansLaPeriode(il_y_a(30), '30j', MAINTENANT, REGLAGES)).toBe(false)
    expect(dansLaPeriode(il_y_a(400), 'tout', MAINTENANT, REGLAGES)).toBe(true)
  })
})

describe('carteDuModule', () => {
  const bloc = (code: string, partie: string, descendu = false) => ({
    bloc: code,
    partie,
    prerequis: [],
    statut: 'vu' as const,
    force: false,
    descendu,
  })

  it('marque les blocs ouverts sans prérequis et les blocs redescendus, sans changer l’ordre', () => {
    const carte = carteDuModule(
      [bloc('B01', 'P1'), bloc('B02', 'P1', true), bloc('B07', 'P2')],
      new Set(['B07']),
    )

    expect(carte.map(({ bloc: code }) => code)).toEqual(['B01', 'B02', 'B07'])
    expect(carte.map(({ prerequisNonValides }) => prerequisNonValides)).toEqual([
      false,
      false,
      true,
    ])
    expect(carte.map(({ redescendu }) => redescendu)).toEqual([false, true, false])
  })

  it('rend une carte vide pour un module sans bloc', () => {
    expect(carteDuModule([], new Set())).toEqual([])
  })
})

describe('erreursRecurrentes', () => {
  const libelles = new Map([
    ['E1', 'Confond A et B.'],
    ['E2', 'Oublie le cas limite.'],
  ])

  it('compte les ouvertures, trie par nombre décroissant et marque celles qui restent ouvertes', () => {
    const faits = [
      cochee('B02', 'E2', 1),
      cochee('B04', 'E1', 2),
      cochee('B03', 'E1', 3),
      cochee('B03', 'E1', 4),
      cochee('B01', 'E2', 40),
    ]

    const erreurs = erreursRecurrentes(
      faits,
      libelles,
      new Set(['E1']),
      '30j',
      MAINTENANT,
      REGLAGES,
    )

    expect(erreurs).toEqual([
      { erreur: 'E1', libelle: 'Confond A et B.', nombre: 3, blocs: ['B03', 'B04'], ouverte: true },
      { erreur: 'E2', libelle: 'Oublie le cas limite.', nombre: 1, blocs: ['B02'], ouverte: false },
    ])
  })

  it('rend une liste vide sans erreur', () => {
    expect(erreursRecurrentes([], libelles, new Set(), 'tout', MAINTENANT, REGLAGES)).toEqual([])
  })
})

describe('décisions', () => {
  it('liste les statuts forcés, les plus récents d’abord, dans la période', () => {
    const faits = [force('B03', 5), force('B05', 1), force('B09', 90)]

    const forces = statutsForces(faits, '30j', MAINTENANT, REGLAGES)

    expect(forces.map(({ bloc }) => bloc)).toEqual(['B05', 'B03'])
    expect(forces[0]).toMatchObject({ statut: 'vu', raison: 'Je l’ai vu en cours.' })
  })

  it('liste les ouvertures sans prérequis avec leur raison, sans les ouvertures normales', () => {
    const faits = [
      ouvert('B07', 3, true, 'Je veux voir la suite.'),
      ouvert('B02', 2, false),
      ouvert('B09', 1, true),
    ]

    expect(ouverturesSansPrerequis(faits, 'tout', MAINTENANT, REGLAGES)).toEqual([
      expect.objectContaining({ bloc: 'B09', raison: null }),
      expect.objectContaining({ bloc: 'B07', raison: 'Je veux voir la suite.' }),
    ])
    expect(blocsOuvertsSansPrerequis(faits)).toEqual(new Set(['B07', 'B09']))
  })

  it('ne rend rien sans fait', () => {
    expect(statutsForces([], 'tout', MAINTENANT, REGLAGES)).toEqual([])
    expect(ouverturesSansPrerequis([], 'tout', MAINTENANT, REGLAGES)).toEqual([])
  })
})

describe('coût de l’IA', () => {
  it('additionne le mois en cours seulement', () => {
    const couts = [
      { date: il_y_a(1), millioniemes: 2_000_000 },
      { date: il_y_a(5), millioniemes: 1_500_000 },
      { date: il_y_a(20), millioniemes: 9_000_000 },
    ]

    expect(depenseDuMois(couts, MAINTENANT, REGLAGES)).toBe(3_500_000)
    expect(depenseDuMois([], MAINTENANT, REGLAGES)).toBe(0)
  })

  it('passe en alerte au-dessus de 80 % seulement', () => {
    expect(budgetEnAlerte(partDuBudget(8_000_000, 10_000_000))).toBe(false)
    expect(budgetEnAlerte(partDuBudget(8_100_000, 10_000_000))).toBe(true)
    expect(partDuBudget(20_000_000, 10_000_000)).toBe(1)
    expect(partDuBudget(0, 0)).toBe(1)
  })
})
