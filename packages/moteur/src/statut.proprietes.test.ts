import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { Niveau, Statut } from '@janus/contrats'
import { apres, DEBUT, fabrique, MANIFESTE, REGLAGES } from './fabrique.ts'
import type { Fait, ReponseVerification } from './faits.ts'
import { calculerBloc } from './statut.ts'

const NIVEAUX: readonly Niveau[] = ['solide', 'partiel', 'fragile', 'pas_encore']
const SERIES = ['restitution', 'consolidation', 'rappel'] as const
const QUESTIONS = [...MANIFESTE.restitution, ...MANIFESTE.consolidation, ...MANIFESTE.rappel].map(
  (q) => q.id,
)
const REPONSES_DE_VERIFICATION: ReponseVerification[] = [
  { type: 'explication', question: 'DE1', tour: 1, niveau: 'solide', compte: true },
  { type: 'tache', question: 'DT1', tour: 1, reussi: true, compte: true },
  { type: 'transfert', question: 'DR1', tour: 1, niveau: 'solide', compte: true },
]

/** Un fait au hasard parmi tous les types, avec des dates sur 60 jours à partir de DEBUT. */
const faitAleatoire: fc.Arbitrary<Fait> = fc
  .tuple(
    fc.integer({ min: 0, max: 60 * 24 * 60 }),
    fc.uuid(),
    fc.oneof(
      fc.record({ type: fc.constant('bloc_ouvert' as const), horsPrerequis: fc.boolean() }),
      fc.record({
        type: fc.constant('etape_vue' as const),
        etape: fc.constantFrom('ET1', 'ET3', 'ET7', 'ET8'),
      }),
      fc.record({
        type: fc.constant('pratique_resultat' as const),
        exercice: fc.constant('PR1'),
        item: fc.constantFrom('PR1-1', 'PR1-2', 'PR1-3'),
        reussi: fc.boolean(),
        aide: fc.constantFrom(0, 1, 2, 3, 4),
      }),
      fc.record({
        type: fc.constant('atelier_resultat' as const),
        reussi: fc.boolean(),
        aide: fc.constantFrom(0, 1, 2, 3, 4),
      }),
      fc.record({
        type: fc.constant('aisance_resultat' as const),
        reussi: fc.boolean(),
        dureeS: fc.integer({ min: 5, max: 60 }),
      }),
      fc.record({
        type: fc.constant('correction' as const),
        serie: fc.constantFrom(...SERIES),
        question: fc.constantFrom(...QUESTIONS),
        tour: fc.integer({ min: 1, max: 3 }),
        niveau: fc.constantFrom(...NIVEAUX),
        compte: fc.boolean(),
        confiance: fc.constantFrom('sur' as const, 'hesitant' as const, 'hasard' as const),
        erreursIa: fc.constant<string[]>([]),
      }),
      fc.record({
        type: fc.constant('verification_terminee' as const),
        verification: fc.constantFrom(
          'verification' as const,
          'retest' as const,
          'entretien' as const,
        ),
        valable: fc.boolean(),
        reponses: fc.constant(REPONSES_DE_VERIFICATION),
      }),
      fc.record({
        type: fc.constant('erreur_cochee' as const),
        erreur: fc.constantFrom('E1', 'E2', 'E3'),
        source: fc.constant('amine' as const),
      }),
      fc.record({
        type: fc.constant('erreur_decochee' as const),
        erreur: fc.constantFrom('E1', 'E2', 'E3'),
        source: fc.constant('amine' as const),
      }),
      fc.record({
        type: fc.constant('statut_force' as const),
        statut: fc.constantFrom<Statut>('vu', 'acquis', 'maitrise'),
        raison: fc.constant('raison'),
      }),
      fc.record({ type: fc.constant('force_levee' as const) }),
    ),
  )
  .map(([minutes, id, donnees]) => ({
    id,
    bloc: MANIFESTE.bloc,
    date: apres(DEBUT, 0, minutes),
    ...donnees,
  }))

const faitsAleatoires = fc.array(faitAleatoire, { minLength: 1, maxLength: 40 })

function calcul(faits: readonly Fait[], maintenant: string = apres(DEBUT, 90)) {
  return calculerBloc(faits, MANIFESTE, REGLAGES, maintenant)
}

/** Du plus bas au plus haut ; « à reprendre » est sous tous les autres. */
const RANG: Record<Statut, number> = {
  a_reprendre: 0,
  non_commence: 1,
  en_cours: 2,
  vu: 3,
  acquis_provisoirement: 4,
  acquis: 5,
  maitrise: 6,
}

describe('propriétés du calcul de statut', () => {
  it('ajouter un fait en double (même identifiant) ne change rien', () => {
    fc.assert(
      fc.property(faitsAleatoires, fc.nat(), (faits, choix) => {
        const doublon = faits[choix % faits.length]
        expect(calcul([...faits, ...(doublon ? [doublon] : [])])).toEqual(calcul(faits))
      }),
    )
  })

  it('mélanger l’ordre d’entrée ne change rien', () => {
    fc.assert(
      fc.property(
        faitsAleatoires.chain((faits) =>
          fc.tuple(
            fc.constant(faits),
            fc.shuffledSubarray(faits, { minLength: faits.length, maxLength: faits.length }),
          ),
        ),
        ([faits, melanges]) => {
          expect(calcul(melanges)).toEqual(calcul(faits))
        },
      ),
    )
  })

  it('ajouter une relance ne fait jamais monter le statut', () => {
    fc.assert(
      fc.property(
        faitsAleatoires,
        fc.constantFrom(...QUESTIONS),
        fc.constantFrom(...NIVEAUX),
        fc.integer({ min: 2, max: 5 }),
        fc.integer({ min: 0, max: 60 * 24 * 60 }),
        (faits, question, niveau, tour, minutes) => {
          const f = fabrique()
          const relance = f.correction(apres(DEBUT, 0, minutes), 'consolidation', question, {
            tour,
            niveau,
            compte: false,
          })
          const avant = calcul(faits).statutCalcule
          const apresRelance = calcul([
            ...faits,
            { ...relance, id: 'relance-ajoutee' },
          ]).statutCalcule
          expect(RANG[apresRelance]).toBeLessThanOrEqual(RANG[avant])
        },
      ),
    )
  })

  it('une erreur ouverte donne toujours « à reprendre »', () => {
    fc.assert(
      fc.property(faitsAleatoires, (faits) => {
        const f = fabrique()
        const derniere = apres(DEBUT, 61)
        const resultat = calcul([...faits, f.cochee(derniere, 'E1')])
        expect(resultat.erreursOuvertes).toContain('E1')
        expect(resultat.statutCalcule).toBe('a_reprendre')
      }),
    )
  })

  it('le statut ne dépend jamais de l’heure du téléphone', () => {
    fc.assert(
      fc.property(
        faitsAleatoires,
        fc.integer({ min: 0, max: 400 }),
        fc.integer({ min: 0, max: 400 }),
        (faits, jourA, jourB) => {
          const a = calcul(faits, apres(DEBUT, jourA))
          const b = calcul(faits, apres(DEBUT, jourB))
          expect(a.statut).toBe(b.statut)
          expect(a.statutCalcule).toBe(b.statutCalcule)
          expect(a.dates).toEqual(b.dates)
          expect(a.erreursOuvertes).toEqual(b.erreursOuvertes)
          expect(a.echecsConsecutifs).toBe(b.echecsConsecutifs)
        },
      ),
    )
  })
})
