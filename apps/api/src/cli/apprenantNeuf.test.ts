import { Manifeste } from '@janus/contrats'
import demo from '@janus/contrats/fixtures/manifeste-demo.json'
import { describe, expect, it } from 'vitest'
import { lireLApprenantNeuf } from './apprenantNeuf.ts'

const MANIFESTE = Manifeste.parse(demo)
const [R1 = '', R2 = ''] = MANIFESTE.restitution.map(({ id }) => id)
const [Q1 = ''] = MANIFESTE.rappel.map(({ id }) => id)

describe('les réponses de l’apprenant neuf', () => {
  it('deviennent un jeu par série, niveau attendu Solide, confiance Sûr', () => {
    const texte = [
      `${R1} : déductible (étape 2, écran 1) : Une fiche contient ses étapes et ses exercices.`,
      `- \`${R2}\` : RECOPIÉE (étape 1, écran 1) : La restitution se fait sans le cours.`,
      `${Q1} : Déductible (étape 3, écran 2) : Un rappel : revoir plus tard.`,
    ].join('\n')
    const lecture = lireLApprenantNeuf(texte, MANIFESTE)
    expect(lecture.jeux.map((jeu) => jeu.serie)).toEqual(['restitution', 'rappel'])
    expect(lecture.jeux[0]?.cas).toEqual([
      {
        id: R1,
        question: R1,
        reponse: 'Une fiche contient ses étapes et ses exercices.',
        confiance: 'sur',
        niveauAmine: 'solide',
        genre: 'normal',
      },
      {
        id: R2,
        question: R2,
        reponse: 'La restitution se fait sans le cours.',
        confiance: 'sur',
        niveauAmine: 'solide',
        genre: 'normal',
      },
    ])
    expect(lecture.jeux[1]?.cas.map(({ reponse }) => reponse)).toEqual([
      'Un rappel : revoir plus tard.',
    ])
    expect(lecture.sansReponse).toEqual(
      [...MANIFESTE.restitution, ...MANIFESTE.rappel]
        .map(({ id }) => id)
        .filter((id) => ![R1, R2, Q1].includes(id)),
    )
    expect(lecture.ignores).toEqual([])
  })

  it('laisse de côté le non déductible, le hors champ, les exercices et les ids inconnus', () => {
    const texte = [
      `${R1} : NON DÉDUCTIBLE : la règle n’est jamais écrite.`,
      `${R2} : HORS CHAMP ASSUMÉ : je ne sais pas.`,
      `P1 : déductible (étape 2, écran 1) : un exercice.`,
      `ZZ : déductible (étape 2, écran 1) : une invention.`,
      'Une ligne qui ne dit rien.',
    ].join('\n')
    const lecture = lireLApprenantNeuf(texte, MANIFESTE)
    expect(lecture.jeux).toEqual([])
    expect(lecture.sansReponse).toContain(R1)
    expect(lecture.sansReponse).toContain(R2)
    expect(lecture.ignores).toEqual(['P1', 'ZZ'])
  })

  it('garde la première réponse quand l’agent répond deux fois à la même question', () => {
    const texte = [
      `${R1} : déductible (étape 2, écran 1) : première.`,
      `${R1} : déductible (étape 2, écran 1) : seconde.`,
    ].join('\n')
    expect(lireLApprenantNeuf(texte, MANIFESTE).jeux[0]?.cas.map(({ reponse }) => reponse)).toEqual(
      ['première.'],
    )
  })
})
