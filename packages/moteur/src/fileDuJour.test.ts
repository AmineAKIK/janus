import { describe, expect, it } from 'vitest'
import type { Manifeste, Tache } from '@janus/contrats'
import { apres, DEBUT, fabrique, jusquaProvisoire, MANIFESTE, REGLAGES } from './fabrique.ts'
import type { Fait } from './faits.ts'
import { enRetard, fileDuJour, tachesDuJour } from './fileDuJour.ts'
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

  it('propose le retest avec son type, puis plus rien une fois réussi', () => {
    const retest = bloc('B01', [], (f) => [...jusquaProvisoire(f), f.verification(apres(DEBUT, 4))])
    expect(fileDuJour(entree([retest], { maintenant: apres(DEBUT, 60) })).taches).toEqual([
      { type: 'retest', bloc: 'B01', apres: '2026-07-05' },
    ])
    const clos = bloc('B01', [], (f) => [
      ...jusquaProvisoire(f),
      f.verification(apres(DEBUT, 4)),
      f.verification(apres(DEBUT, 40), { verification: 'retest' }),
      f.aisance(apres(DEBUT, 41), 30),
      f.aisance(apres(DEBUT, 42), 30),
    ])
    expect(fileDuJour(entree([clos], { maintenant: apres(DEBUT, 200) })).taches).toEqual([])
  })

  it('mène une erreur critique vers l’étape du bloc quand le manifeste en donne une', () => {
    const blocs = [bloc('B01', [], (f) => [f.cochee(DEBUT, 'E3'), f.cochee(DEBUT, 'E9')])]
    const [premiere, seconde] = fileDuJour(entree(blocs)).taches
    expect(premiere).toMatchObject({ erreur: 'E3', lien: '/blocs/B01?etape=ET7' })
    expect(seconde).toMatchObject({ erreur: 'E9', libelle: 'E9', lien: '/blocs/B01' })
  })

  it('propose de finir sans aide la pratique d’un autre bloc, vers son étape de pratique', () => {
    const etape = MANIFESTE.etapes.find(({ type }) => type === 'pratique')?.id
    expect(etape).toBeDefined()
    const blocs = [
      bloc('B01', [], (f) => jusquaProvisoire(f, [2, 0])),
      bloc('B02', [], (f) => f.restitution(apres(DEBUT, 1))),
    ]
    const taches = fileDuJour(entree(blocs)).taches
    const pratique = taches.find(({ type }) => type === 'pratique')
    expect(pratique).toEqual({
      type: 'pratique',
      bloc: 'B01',
      exercices: blocs[0]?.etat.manque.find(({ code }) => code === 'pratique_aide')?.exercices,
      lien: `/blocs/B01?etape=${String(etape)}`,
    })
    expect(pratique?.type === 'pratique' && pratique.exercices.length).toBeGreaterThan(0)
    // Avant le bloc en cours, après les cartes.
    expect(taches.map(({ type }) => type).slice(-2)).toEqual(['pratique', 'bloc'])
  })

  it('ne double pas le bloc en cours d’une tâche de pratique, ni un bloc dont la pratique est faite', () => {
    const blocs = [
      bloc('B01', [], (f) => jusquaProvisoire(f)),
      bloc('B02', [], (f) =>
        jusquaProvisoire(f, [2, 0]).map((x) => ({ ...x, date: apres(x.date, 1) })),
      ),
    ]
    expect(blocs[1]?.etat.manque.map(({ code }) => code)).toContain('pratique_aide')
    expect(fileDuJour(entree(blocs)).taches.at(-1)).toEqual({ type: 'bloc', bloc: 'B02' })
    expect(types(entree(blocs))).not.toContain('pratique')
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
      expect(resultat.taches.map((t) => t.type)).toEqual(['reprise', 'verification', 'bloc'])
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

describe('tachesDuJour', () => {
  const lien = (tache: Tache) => `/${tache.type}`
  const questions: Tache = { type: 'questions_debut', nombre: 3 }
  const cartes: Tache = { type: 'cartes', dues: 4, nouvelles: 2 }
  const bloc: Tache = { type: 'bloc', bloc: 'B01' }
  const rien = { questionsRepondues: 0, cartesRevues: 0 }

  it('ne marque rien de fait quand rien ne s’est fait', () => {
    const jour = tachesDuJour([questions, cartes, bloc], rien, lien)

    expect(jour.map(({ faite }) => faite)).toEqual([false, false, false])
    expect(jour.map(({ lien: chemin }) => chemin)).toEqual(['/questions_debut', '/cartes', '/bloc'])
  })

  it('marque les questions de début de séance faites quand toute la série a sa réponse', () => {
    const partielles = tachesDuJour([questions], { ...rien, questionsRepondues: 2 }, lien)
    const toutes = tachesDuJour([questions], { ...rien, questionsRepondues: 3 }, lien)

    expect(partielles[0]?.faite).toBe(false)
    expect(toutes[0]?.faite).toBe(true)
  })

  it('garde la révision terminée dans la journée, avant le bloc en cours', () => {
    const jour = tachesDuJour([questions, bloc], { ...rien, cartesRevues: 5 }, lien)

    expect(jour.map(({ tache }) => tache.type)).toEqual(['questions_debut', 'cartes', 'bloc'])
    expect(jour[1]).toMatchObject({ tache: { dues: 0, nouvelles: 0 }, faite: true })
  })

  it('ajoute la révision terminée à la fin quand il n’y a pas de bloc en cours', () => {
    const jour = tachesDuJour([questions], { ...rien, cartesRevues: 1 }, lien)

    expect(jour.map(({ tache }) => tache.type)).toEqual(['questions_debut', 'cartes'])
  })

  it('ne duplique pas les cartes quand il en reste à faire', () => {
    const jour = tachesDuJour([cartes, bloc], { ...rien, cartesRevues: 3 }, lien)

    expect(jour.map(({ tache }) => tache.type)).toEqual(['cartes', 'bloc'])
    expect(jour[0]?.faite).toBe(false)
  })
})
