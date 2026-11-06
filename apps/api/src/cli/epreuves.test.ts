import { describe, expect, it } from 'vitest'
import {
  epreuvesAJouer,
  lireLeCompte,
  mancheSuivante,
  verdict,
  type Compte,
  type Epreuve,
} from './epreuves.ts'

const entrees = (
  texte: string,
  conception: string,
  grille = 'grille',
  plan = 'plan',
): Map<string, string> =>
  new Map([
    ['texte.txt', texte],
    ['texte-cours.txt', texte.split('## Ce qu’on te demande')[0] ?? ''],
    ['texte-conception.txt', conception],
    ['grille.md', grille],
    ['manifeste.json', '{}'],
    ['regles.json', '[]'],
    ['plan.md', plan],
    ['AGENTS.md', 'leçons'],
  ])

describe('les épreuves à rejouer', () => {
  it('sont les quatre à la première manche', () => {
    expect(epreuvesAJouer(undefined, entrees('a', 'b'))).toEqual([
      'apprenant-neuf',
      'parcours',
      'gardien',
      'relecteur',
    ])
  })
  it('sont celles dont une entrée a changé', () => {
    const avant = entrees('cours ## Ce qu’on te demande questions', 'conception')
    expect(
      epreuvesAJouer(avant, entrees('cours ## Ce qu’on te demande questions', 'conception')),
    ).toEqual([])
    expect(
      epreuvesAJouer(avant, entrees('cours ## Ce qu’on te demande autres', 'conception')),
    ).toEqual(['apprenant-neuf'])
    expect(
      epreuvesAJouer(avant, entrees('autre cours ## Ce qu’on te demande questions', 'conception')),
    ).toEqual(['apprenant-neuf', 'parcours'])
    expect(
      epreuvesAJouer(
        avant,
        entrees('cours ## Ce qu’on te demande questions', 'conception', 'grille 2'),
      ),
    ).toEqual(['gardien', 'relecteur'])
    expect(
      epreuvesAJouer(
        avant,
        entrees('cours ## Ce qu’on te demande questions', 'conception', 'grille', 'plan 2'),
      ),
    ).toEqual(['gardien'])
  })
})

describe('le compte d’un rapport', () => {
  it('se calcule sur les lignes de l’apprenant neuf', () => {
    const rapport = [
      'B06-R1 : déductible (ET4, écran 2) : la box sépare.',
      '- `B06-R2` : RECOPIÉE (ET7) : le DNS traduit.',
      'B06-Q3 : NON DÉDUCTIBLE : le NAT n’est jamais écrit.',
      'B06-C1 : hors champ assumé : je ne sais pas.',
      'Une ligne qui n’est pas une réponse : rien.',
    ].join('\n')
    const lu = lireLeCompte(rapport, 'apprenant-neuf')
    expect(lu).toEqual({
      ok: true,
      compte: new Map([
        ['déductibles', 1],
        ['recopiées', 1],
        ['non déductibles', 1],
        ['hors champ', 1],
      ]),
    })
    expect(lireLeCompte('rien', 'apprenant-neuf')).toEqual({
      ok: false,
      manque: ['aucune ligne « ID : verdict : réponse »'],
    })
  })
  it('se lit dans le bloc « ## Compte » des autres épreuves', () => {
    const rapport = [
      '# Rapport',
      'blabla',
      '## Compte',
      '- bloquants : 0',
      '- Gênants : 3',
      '- mineurs: 2',
    ].join('\n')
    expect(lireLeCompte(rapport, 'relecteur')).toEqual({
      ok: true,
      compte: new Map([
        ['bloquants', 0],
        ['gênants', 3],
        ['mineurs', 2],
      ]),
    })
    expect(
      lireLeCompte(
        "## Compte\n- décrochages : 0\n- îles : 1\n- abstraits d'affilée : 2",
        'parcours',
      ),
    ).toEqual({
      ok: true,
      compte: new Map([
        ['décrochages', 0],
        ['îles', 1],
        ['abstraits d’affilée', 2],
      ]),
    })
  })
  it('dit ce qui manque', () => {
    expect(lireLeCompte('pas de bloc', 'gardien')).toEqual({
      ok: false,
      manque: ['le bloc final « ## Compte »'],
    })
    expect(lireLeCompte('## Compte\n- contestées : 1', 'gardien')).toEqual({
      ok: false,
      manque: ['le compte « écarts contestés »', 'le compte « violées hors grille »'],
    })
  })
})

describe('la règle d’arrêt', () => {
  const comptes = (
    modifs: Partial<Record<Epreuve, Record<string, number>>>,
  ): Record<Epreuve, Compte> => ({
    'apprenant-neuf': new Map(
      Object.entries({ 'non déductibles': 0, recopiées: 0, ...modifs['apprenant-neuf'] }),
    ),
    parcours: new Map(
      Object.entries({ décrochages: 0, îles: 0, 'abstraits d’affilée': 2, ...modifs.parcours }),
    ),
    gardien: new Map(
      Object.entries({
        contestées: 0,
        'écarts contestés': 0,
        'violées hors grille': 0,
        ...modifs.gardien,
      }),
    ),
    relecteur: new Map(
      Object.entries({ bloquants: 0, gênants: 0, mineurs: 0, ...modifs.relecteur }),
    ),
  })
  it('arrête quand plus rien ne bloque, et garde les gênants à trancher', () => {
    expect(verdict(comptes({}))).toEqual({ arret: true, bloquant: [], aTrancher: [] })
    expect(verdict(comptes({ relecteur: { gênants: 3, mineurs: 1 } }))).toEqual({
      arret: true,
      bloquant: [],
      aTrancher: ['relecteur : 3 gênants', 'relecteur : 1 mineurs'],
    })
  })
  it('relance sur un recopié, un décrochage, une ligne contestée, un bloquant ou cinq écrans abstraits', () => {
    expect(verdict(comptes({ 'apprenant-neuf': { recopiées: 1 } })).bloquant).toEqual([
      'apprenant-neuf : 1 recopiées',
    ])
    expect(verdict(comptes({ parcours: { décrochages: 2 } })).bloquant).toEqual([
      'parcours : 2 décrochages',
    ])
    expect(verdict(comptes({ gardien: { contestées: 1 } })).bloquant).toEqual([
      'gardien : 1 contestées',
    ])
    expect(verdict(comptes({ relecteur: { bloquants: 1 } })).arret).toBe(false)
    expect(verdict(comptes({ parcours: { 'abstraits d’affilée': 5 } })).bloquant).toEqual([
      'parcours : 5 écrans abstraits d’affilée (quatre au plus)',
    ])
  })
})

describe('le numéro de manche', () => {
  it('suit les dossiers v<n> présents', () => {
    expect(mancheSuivante([])).toBe(1)
    expect(mancheSuivante(['v1', 'v3', 'plan.md', 'v10'])).toBe(11)
  })
})
