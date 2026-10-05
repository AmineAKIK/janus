import { describe, expect, it } from 'vitest'
import type { Niveau } from '@janus/contrats'
import { apres, DEBUT, fabrique, MANIFESTE, REGLAGES } from './fabrique.ts'
import type { Fait } from './faits.ts'
import { choisirQuestionsDebut } from './questionsDebut.ts'
import type { BlocVu } from './questionsDebut.ts'

const AUTRE = { ...MANIFESTE, bloc: 'D02' }
const seul: BlocVu[] = [{ manifeste: MANIFESTE, prerequisDuBlocEnCours: false }]
const deux: BlocVu[] = [
  { manifeste: MANIFESTE, prerequisDuBlocEnCours: false },
  { manifeste: AUTRE, prerequisDuBlocEnCours: false },
]
const cinq = { ...REGLAGES, questionsDebut: 5 }

function reponse(
  f: ReturnType<typeof fabrique>,
  jours: number,
  question: string,
  niveau: Niveau,
  confiance: 'sur' | 'hesitant' = 'hesitant',
): Fait {
  const fait = f.correction(apres(DEBUT, jours), 'rappel', question, { niveau })
  return fait.type === 'correction' ? { ...fait, confiance } : fait
}

function ids(
  blocs: readonly BlocVu[],
  historique: readonly Fait[],
  graine: number,
  reglages = cinq,
) {
  return choisirQuestionsDebut(blocs, historique, reglages, graine).map(
    ({ bloc, question }) => `${bloc}:${question}`,
  )
}

describe('choisirQuestionsDebut', () => {
  it('ne rend rien sans bloc vu', () => {
    expect(choisirQuestionsDebut([], [], REGLAGES, 1)).toEqual([])
  })

  it('rend le nombre de questions des réglages, sans doublon', () => {
    for (const graine of [0, 1, 2, 3]) {
      const choix = ids(seul, [], graine, REGLAGES)
      expect(choix).toHaveLength(6)
      expect(new Set(choix).size).toBe(6)
      expect(ids(deux, [], graine, { ...REGLAGES, questionsDebut: 9 })).toHaveLength(9)
    }
  })

  it('rend toutes les questions quand la réserve est plus petite que le nombre demandé', () => {
    expect(ids(seul, [], 4, { ...REGLAGES, questionsDebut: 10 })).toHaveLength(6)
  })

  it('met d’abord les notions ratées ou fragiles, puis les erreurs faites en étant sûr', () => {
    const f = fabrique()
    const historique = [
      reponse(f, 1, 'RA2', 'fragile'),
      reponse(f, 1, 'RA5', 'pas_encore'),
      reponse(f, 1, 'RA4', 'solide', 'sur'),
      reponse(f, 1, 'RA4', 'pas_encore', 'sur'),
      reponse(f, 2, 'RA4', 'solide'),
      reponse(f, 2, 'RA1', 'solide'),
    ]
    for (const graine of [0, 1, 2, 3, 4, 5]) {
      const choix = choisirQuestionsDebut(seul, historique, cinq, graine)
      expect(choix.map(({ priorite }) => priorite)).toEqual([1, 1, 2, 4, 4])
      expect(
        choix
          .slice(0, 2)
          .map(({ question }) => question)
          .sort(),
      ).toEqual(['RA2', 'RA5'])
      expect(choix[2]?.question).toBe('RA4')
    }
  })

  it('juge la notion sur la dernière réponse seulement pour « ratée ou fragile »', () => {
    const f = fabrique()
    const historique = [reponse(f, 1, 'RA2', 'fragile'), reponse(f, 2, 'RA2', 'solide')]
    for (const graine of [0, 1, 2, 3]) {
      expect(
        choisirQuestionsDebut(seul, historique, cinq, graine).every(
          ({ priorite }) => priorite === 4,
        ),
      ).toBe(true)
    }
  })

  it('départage deux réponses de même date par leur identifiant', () => {
    const f = fabrique()
    const fragile = reponse(f, 1, 'RA2', 'fragile')
    const solide = reponse(f, 1, 'RA2', 'solide')
    for (const historique of [
      [fragile, solide],
      [solide, fragile],
    ]) {
      expect(
        choisirQuestionsDebut(seul, historique, cinq, 1).every(({ priorite }) => priorite === 4),
      ).toBe(true)
    }
  })

  it('remonte une erreur faite en étant sûr dans les séances suivantes', () => {
    const f = fabrique()
    const historique = [reponse(f, 1, 'RA3', 'fragile', 'sur'), reponse(f, 2, 'RA3', 'solide')]
    for (let graine = 0; graine < 30; graine += 1) {
      expect(ids(seul, historique, graine)).toContain(`${MANIFESTE.bloc}:RA3`)
    }
    const tous = Array.from({ length: 30 }, (_, graine) => ids(seul, [], graine))
    expect(tous.some((choix) => !choix.includes(`${MANIFESTE.bloc}:RA3`))).toBe(true)
  })

  it('met ensuite les questions des blocs prérequis du bloc en cours', () => {
    const blocs: BlocVu[] = [
      { manifeste: MANIFESTE, prerequisDuBlocEnCours: false },
      { manifeste: AUTRE, prerequisDuBlocEnCours: true },
    ]
    const f = fabrique()
    const historique = [reponse(f, 1, 'RA1', 'fragile')]
    for (const graine of [0, 1, 2, 3, 4]) {
      const choix = choisirQuestionsDebut(blocs, historique, cinq, graine)
      expect(choix.filter(({ priorite }) => priorite === 1)).toHaveLength(1)
      expect(choix.filter(({ bloc, priorite }) => bloc === 'D02' && priorite === 3)).toHaveLength(4)
    }
  })

  it('ignore l’historique des autres blocs et les faits qui ne sont pas des corrections', () => {
    const autre = fabrique('D99')
    const f = fabrique()
    const historique = [reponse(autre, 1, 'RA2', 'fragile'), f.ouverture(DEBUT)]
    expect(
      choisirQuestionsDebut(seul, historique, cinq, 1).every(({ priorite }) => priorite === 4),
    ).toBe(true)
  })

  it('tire de la même façon pour une même graine, quel que soit l’ordre de l’historique', () => {
    const f = fabrique()
    const historique = [reponse(f, 1, 'RA2', 'fragile'), reponse(f, 2, 'RA4', 'pas_encore', 'sur')]
    expect(ids(deux, historique, 7)).toEqual(ids(deux, [...historique].reverse(), 7))
    const differents = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((graine) => ids(deux, [], graine).join()),
    )
    expect(differents.size).toBeGreaterThan(1)
  })

  it('mélange les blocs dès que deux blocs sont vus, pas avant', () => {
    const groupes = (choix: readonly string[]) =>
      choix.filter(
        (question, rang) => rang > 0 && question.slice(0, 3) !== choix[rang - 1]?.slice(0, 3),
      ).length
    const melanges = Array.from({ length: 20 }, (_, graine) =>
      groupes(ids(deux, [], graine, { ...REGLAGES, questionsDebut: 10 })),
    )
    expect(melanges.some((changements) => changements > 1)).toBe(true)
    const f = fabrique()
    const historique = [reponse(f, 1, 'RA1', 'fragile'), reponse(f, 1, 'RA2', 'fragile')]
    expect(ids(seul, historique, 3).slice(0, 2).sort()).toEqual([
      `${MANIFESTE.bloc}:RA1`,
      `${MANIFESTE.bloc}:RA2`,
    ])
  })
})
