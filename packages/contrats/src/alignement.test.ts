import { describe, expect, it } from 'vitest'
import demo from '../fixtures/manifeste-demo.json' with { type: 'json' }
import { validerAlignement } from './alignement.ts'
import { validerManifeste } from './validerManifeste.ts'

const resultat = validerManifeste(demo)
if (!resultat.ok) throw new Error('Le manifeste de démonstration doit être valide.')
const manifeste = resultat.manifeste

interface Notion {
  id: string
  notion: string
  montree: string[]
  pratiquee: string[]
  questions: string[]
}

interface Relation {
  id: string
  de: string
  vers: string
  type: string
  montree: string
  questions: string[]
}

interface Tableau {
  bloc: string
  notions: Notion[]
  relations?: Relation[]
  ensemble?: { montree: string; rappelee: string; questions: string[] }
  hors_objectif: string[]
}

/** Le tableau du bloc de démonstration : deux notions qui se partagent ses questions et ses cartes. */
function tableau(): Tableau {
  return {
    bloc: 'D01',
    notions: [
      {
        id: 'N1',
        notion: 'Écrire une condition composée',
        montree: ['ET3'],
        pratiquee: ['PR1', 'AT1', 'ET6'],
        questions: ['R1', 'R2', 'R3', 'RA1', 'RA2', 'RA3', 'DE1', 'DE2', 'DT1', 'DT2'],
      },
      {
        id: 'N2',
        notion: 'Évaluer une condition composée',
        montree: ['ET3'],
        pratiquee: [],
        questions: ['R4', 'R5', 'RA4', 'RA5', 'RA6', 'DE3', 'DE4', 'DT3', 'DT4'],
      },
    ],
    hors_objectif: ['Les opérateurs bit à bit'],
  }
}

/** Les questions et cartes qu'aucune notion du tableau ne prend encore. */
const RESTE = ['DR1', 'DR2', 'DR3', 'DR4', 'CA1', 'CA2', 'CA3', 'CA4']

function complet() {
  const brouillon = tableau()
  brouillon.notions[1]?.questions.push(...RESTE)
  return brouillon
}

function notion(brouillon: { notions: Notion[] }, id: string): Notion {
  const trouvee = brouillon.notions.find((n) => n.id === id)
  if (trouvee === undefined) throw new Error(`Pas de notion ${id}.`)
  return trouvee
}

describe('validerAlignement', () => {
  it('accepte un tableau qui rattache chaque question et chaque carte à une notion montrée', () => {
    expect(validerAlignement(complet(), manifeste)).toEqual([])
  })

  it('refuse une question ou une carte rattachée à aucune notion de l’objectif', () => {
    const brouillon = tableau()
    notion(brouillon, 'N2').questions.push(...RESTE.filter((id) => id !== 'DR4' && id !== 'CA4'))
    notion(brouillon, 'N2').questions = notion(brouillon, 'N2').questions.filter(
      (id) => id !== 'R5',
    )

    expect(validerAlignement(brouillon, manifeste)).toEqual([
      {
        chemin: '',
        message: expect.stringContaining(
          'R5 (restitution) n’est rattachée à aucune notion de l’objectif',
        ) as string,
      },
      {
        chemin: '',
        message: expect.stringContaining('DR4 (differees) n’est rattachée') as string,
      },
      { chemin: '', message: expect.stringContaining('CA4 (cartes) n’est rattachée') as string },
    ])
  })

  it('refuse un rattachement à une étape qui n’explique pas, ou à ce qui n’existe pas', () => {
    const brouillon = complet()
    const n1 = notion(brouillon, 'N1')
    n1.montree = ['ET4']
    n1.pratiquee.push('PR9')
    n1.questions.push('R9')

    expect(validerAlignement(brouillon, manifeste)).toEqual([
      {
        chemin: 'notions[0].montree',
        message: 'ET4 n’est pas une étape d’explication de la fiche.',
      },
      {
        chemin: 'notions[0].pratiquee',
        message: 'PR9 n’est ni un exercice de pratique, ni l’atelier, ni l’aisance de la fiche.',
      },
      {
        chemin: 'notions[0].questions',
        message: 'R9 n’est ni une question ni une carte du manifeste.',
      },
    ])
  })

  it('refuse une explication ou un exercice qui ne sert aucune notion', () => {
    const brouillon = complet()
    notion(brouillon, 'N1').pratiquee = ['AT1']
    const avecUnDetour = {
      ...manifeste,
      etapes: [
        ...manifeste.etapes,
        { id: 'ET10', titre: 'Pour aller plus loin', type: 'explication' as const },
      ],
    }

    expect(validerAlignement(brouillon, avecUnDetour)).toEqual([
      {
        chemin: '',
        message: expect.stringContaining(
          'L’étape ET10 (explication) n’enseigne aucune notion de l’objectif',
        ) as string,
      },
      {
        chemin: '',
        message: expect.stringContaining(
          'L’exercice PR1 n’entraîne aucune notion de l’objectif',
        ) as string,
      },
    ])
  })

  it('accepte des relations et un ensemble, dont les questions comptent comme rattachées', () => {
    const brouillon = tableau()
    notion(brouillon, 'N2').questions.push(...RESTE.filter((id) => id !== 'DR4' && id !== 'CA4'))
    brouillon.relations = [
      { id: 'L1', de: 'N1', vers: 'N2', type: 'sequence', montree: 'ET3', questions: ['DR4'] },
    ]
    brouillon.ensemble = { montree: 'ET3', rappelee: 'ET7', questions: ['CA4'] }

    expect(validerAlignement(brouillon, manifeste)).toEqual([])
  })

  it('refuse une relation entre des notions inconnues, vers ce que la fiche n’a pas, ou en double', () => {
    const brouillon = complet()
    brouillon.relations = [
      { id: 'L1', de: 'N9', vers: 'N2', type: 'cause', montree: 'ET99', questions: ['R9'] },
      { id: 'L1', de: 'N1', vers: 'N2', type: 'cause', montree: 'ET3', questions: ['R1'] },
    ]

    expect(validerAlignement(brouillon, manifeste)).toEqual([
      { chemin: 'relations[0].de', message: 'N9 n’est pas une notion du tableau.' },
      { chemin: 'relations[0].montree', message: 'ET99 n’est pas une étape de la fiche.' },
      {
        chemin: 'relations[0].questions',
        message: 'R9 n’est ni une question ni une carte du manifeste.',
      },
      { chemin: 'relations[1].id', message: 'L’identifiant L1 est déjà pris.' },
    ])
  })

  it('refuse un ensemble dont les étapes ou les questions n’existent pas, et un type de relation inconnu', () => {
    const brouillon = complet()
    brouillon.ensemble = { montree: 'ET99', rappelee: 'ET98', questions: ['Z1'] }

    expect(validerAlignement(brouillon, manifeste)).toEqual([
      { chemin: 'ensemble.montree', message: 'ET99 n’est pas une étape de la fiche.' },
      { chemin: 'ensemble.rappelee', message: 'ET98 n’est pas une étape de la fiche.' },
      {
        chemin: 'ensemble.questions',
        message: 'Z1 n’est ni une question ni une carte du manifeste.',
      },
    ])

    const inconnu = complet()
    inconnu.relations = [
      { id: 'L1', de: 'N1', vers: 'N2', type: 'ressemble', montree: 'ET3', questions: ['R1'] },
    ]
    expect(validerAlignement(inconnu, manifeste)).toEqual([
      {
        chemin: 'relations[0].type',
        message:
          'Valeur non autorisée. Valeurs possibles : cause, composition, categorie, condition, equivalence, opposition, sequence.',
      },
    ])
  })

  it('refuse le tableau d’un autre bloc, et deux notions sous le même identifiant', () => {
    const brouillon = complet()
    brouillon.bloc = 'D02'
    notion(brouillon, 'N2').id = 'N1'

    expect(validerAlignement(brouillon, manifeste)).toEqual([
      { chemin: 'bloc', message: 'Ce tableau est celui de D02, la fiche est celle de D01.' },
      { chemin: 'notions[1].id', message: 'L’identifiant N1 est déjà pris.' },
    ])
  })

  it('dit en français ce qui manque dans la structure, avec le chemin du champ', () => {
    const brouillon = complet()
    notion(brouillon, 'N2').montree = []
    const sansObjectif: Record<string, unknown> = { ...brouillon }
    delete sansObjectif['hors_objectif']

    expect(validerAlignement(sansObjectif, manifeste)).toEqual([
      { chemin: 'notions[1].montree', message: 'Cette valeur doit être au moins 1.' },
      { chemin: 'hors_objectif', message: 'Ce champ est obligatoire.' },
    ])
  })
})
