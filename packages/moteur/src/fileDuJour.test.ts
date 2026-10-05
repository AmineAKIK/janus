import { describe, expect, it } from 'vitest'
import type { Manifeste } from '@janus/contrats'
import { apres, DEBUT, fabrique, jusquaProvisoire, MANIFESTE, REGLAGES } from './fabrique.ts'
import type { Fait } from './faits.ts'
import { enRetard, fileDuJour } from './fileDuJour.ts'
import type { BlocDeLaFile, EntreeFile } from './fileDuJour.ts'
import { calculerBloc } from './statut.ts'

const MAINTENANT = apres(DEBUT, 10)

function bloc(
  code: string,
  prerequis: string[],
  faits: (f: ReturnType<typeof fabrique>) => Fait[],
): BlocDeLaFile {
  const manifeste: Manifeste = { ...MANIFESTE, bloc: code, prerequis }
  const liste = faits(fabrique(code))
  const dernier =
    liste
      .map(({ date }) => date)
      .sort()
      .at(-1) ?? null
  return {
    manifeste,
    etat: calculerBloc(liste, manifeste, REGLAGES, MAINTENANT),
    dernierFait: dernier,
  }
}

const aucune = { dues: [], nouvelles: [] }

function entree(blocs: BlocDeLaFile[], reste: Partial<EntreeFile> = {}): EntreeFile {
  return {
    blocs,
    questionsDebut: 0,
    cartes: aucune,
    derniereActivite: null,
    maintenant: MAINTENANT,
    reglages: REGLAGES,
    ...reste,
  }
}

const types = (e: EntreeFile) => fileDuJour(e).taches.map((t) => t.type)

describe('fileDuJour', () => {
  it('range tous les types de tâches dans l’ordre du cadrage', () => {
    const blocs = [
      bloc('B01', [], (f) => [...jusquaProvisoire(f)]),
      bloc('B02', [], (f) => [...jusquaProvisoire(f)]),
      bloc('B03', ['B01'], (f) => f.restitution(apres(DEBUT, 9))),
      bloc('B04', [], (f) => [f.cochee(apres(DEBUT, 9), 'E1')]),
      bloc('B05', [], () => []),
    ]
    const resultat = fileDuJour(
      entree(blocs, {
        questionsDebut: 6,
        cartes: { dues: ['c1', 'c2'], nouvelles: ['c3'] },
        derniereActivite: apres(DEBUT, 9),
        maintenant: apres(DEBUT, 9, 600),
      }),
    )
    expect(resultat.enRetard).toBe(false)
    expect(resultat.taches).toEqual([
      {
        type: 'reprendre_erreur',
        bloc: 'B04',
        erreur: 'E1',
        libelle: MANIFESTE.erreurs_critiques[0]?.libelle,
        lien: '/blocs/B04',
      },
      { type: 'questions_debut', nombre: 6 },
      { type: 'verification', bloc: 'B01', apres: '2026-06-04' },
      { type: 'verification', bloc: 'B02', apres: '2026-06-04' },
      { type: 'consolidation', bloc: 'B03', apres: apres(DEBUT, 9, 4 + 60) },
      { type: 'cartes', dues: 2, nouvelles: 1 },
      { type: 'bloc', bloc: 'B03' },
    ])
  })

  it('met les vérifications des prérequis du bloc en cours avant les autres', () => {
    const blocs = [
      bloc('B01', [], (f) => jusquaProvisoire(f)),
      bloc('B02', [], (f) => jusquaProvisoire(f)),
      bloc('B03', ['B02'], (f) => f.restitution(apres(DEBUT, 9))),
    ]
    const taches = fileDuJour(entree(blocs)).taches.filter(({ type }) => type === 'verification')
    expect(taches.map((t) => ('bloc' in t ? t.bloc : ''))).toEqual(['B02', 'B01'])
  })

  it('met le nouveau contenu après le retard', () => {
    const blocs = [bloc('B01', [], (f) => jusquaProvisoire(f)), bloc('B02', [], () => [])]
    expect(types(entree(blocs))).toEqual(['verification', 'bloc'])
    expect(fileDuJour(entree(blocs)).taches.at(-1)).toEqual({ type: 'bloc', bloc: 'B02' })
  })

  it('ne propose pas une échéance qui n’est pas encore atteinte', () => {
    const blocs = [bloc('B01', [], (f) => jusquaProvisoire(f))]
    expect(types(entree(blocs, { maintenant: apres(DEBUT, 1) }))).toEqual([])
  })

  it('propose les retests et les entretiens avec leur type', () => {
    const retest = bloc('B01', [], (f) => [...jusquaProvisoire(f), f.verification(apres(DEBUT, 4))])
    expect(fileDuJour(entree([retest], { maintenant: apres(DEBUT, 60) })).taches).toEqual([
      { type: 'retest', bloc: 'B01', apres: '2026-07-05' },
    ])
    const entretien = bloc('B01', [], (f) => [
      ...jusquaProvisoire(f),
      f.verification(apres(DEBUT, 4)),
      f.verification(apres(DEBUT, 40), { verification: 'retest' }),
      f.aisance(apres(DEBUT, 41), 30),
      f.aisance(apres(DEBUT, 42), 30),
    ])
    expect(fileDuJour(entree([entretien], { maintenant: apres(DEBUT, 200) })).taches).toEqual([
      { type: 'entretien', bloc: 'B01', apres: '2026-10-11' },
    ])
  })

  it('mène une erreur critique vers l’étape du bloc quand le manifeste en donne une', () => {
    const blocs = [bloc('B01', [], (f) => [f.cochee(DEBUT, 'E3'), f.cochee(DEBUT, 'E9')])]
    const [premiere, seconde] = fileDuJour(entree(blocs)).taches
    expect(premiere).toMatchObject({ erreur: 'E3', lien: '/blocs/B01?etape=ET7' })
    expect(seconde).toMatchObject({ erreur: 'E9', libelle: 'E9', lien: '/blocs/B01' })
  })

  it('propose le premier bloc non commencé quand rien n’est en cours', () => {
    const blocs = [
      bloc('B01', [], (f) => jusquaProvisoire(f).concat(f.verification(apres(DEBUT, 4)))),
      bloc('B02', [], () => []),
    ]
    expect(fileDuJour(entree(blocs, { maintenant: apres(DEBUT, 5) })).taches).toEqual([
      { type: 'bloc', bloc: 'B02' },
    ])
  })

  it('ne propose rien quand tout est fait', () => {
    expect(fileDuJour(entree([])).taches).toEqual([])
  })

  it('n’ajoute pas de cartes sans carte à faire', () => {
    expect(types(entree([bloc('B01', [], () => [])]))).toEqual(['bloc'])
    expect(
      types(entree([bloc('B01', [], () => [])], { cartes: { dues: [], nouvelles: ['n'] } })),
    ).toEqual(['cartes', 'bloc'])
  })

  describe('en retard', () => {
    const blocs = [
      bloc('B01', [], (f) => jusquaProvisoire(f)),
      bloc('B02', [], () => []),
      bloc('B03', ['B01', 'B02'], (f) => f.restitution(apres(DEBUT, 9))),
    ]

    it('propose d’abord de reprendre les prérequis déjà commencés du bloc en cours', () => {
      const resultat = fileDuJour(
        entree(blocs, { derniereActivite: DEBUT, maintenant: apres(DEBUT, 20) }),
      )
      expect(resultat.enRetard).toBe(true)
      expect(resultat.taches.map((t) => t.type)).toEqual([
        'reprise',
        'verification',
        'consolidation',
        'bloc',
      ])
      expect(resultat.taches[0]).toEqual({ type: 'reprise', blocs: ['B01'] })
    })

    it('ne propose pas de reprise sans prérequis commencé', () => {
      const seul = [bloc('B01', [], (f) => f.restitution(apres(DEBUT, 9)))]
      const resultat = fileDuJour(
        entree(seul, { derniereActivite: DEBUT, maintenant: apres(DEBUT, 20) }),
      )
      expect(resultat.enRetard).toBe(true)
      expect(resultat.taches.map((t) => t.type)).not.toContain('reprise')
    })

    it('ne propose pas de reprise quand aucun bloc n’est en cours', () => {
      const resultat = fileDuJour(
        entree([], { derniereActivite: DEBUT, maintenant: apres(DEBUT, 20) }),
      )
      expect(resultat.taches).toEqual([])
    })
  })
})

describe('enRetard', () => {
  it('vaut vrai 7 jours (de jourDe) après la dernière activité, pas avant', () => {
    expect(enRetard(DEBUT, 0, apres(DEBUT, 6, 600), REGLAGES)).toBe(false)
    expect(enRetard(DEBUT, 0, apres(DEBUT, 7), REGLAGES)).toBe(true)
    expect(enRetard(DEBUT, 0, apres(DEBUT, 30), REGLAGES)).toBe(true)
  })

  it('vaut vrai quand plus de 50 cartes sont dues', () => {
    expect(enRetard(DEBUT, 50, apres(DEBUT, 1), REGLAGES)).toBe(false)
    expect(enRetard(DEBUT, 51, apres(DEBUT, 1), REGLAGES)).toBe(true)
  })

  it('vaut faux sans aucune activité et sans cartes en retard', () => {
    expect(enRetard(null, 0, MAINTENANT, REGLAGES)).toBe(false)
    expect(enRetard(null, 80, MAINTENANT, REGLAGES)).toBe(true)
  })
})
