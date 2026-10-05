import { describe, expect, it } from 'vitest'
import type { Statut } from '@janus/contrats'
import { blocEnCours, seances, validiteVerification } from './definitions.ts'
import { apres, DEBUT, fabrique, REGLAGES } from './fabrique.ts'
import type { ReponseVerification } from './faits.ts'

describe('blocEnCours', () => {
  const plan = (lignes: readonly (readonly [string, Statut, string | null])[]) =>
    lignes.map(([bloc, statut, dernierFait]) => ({ bloc, statut, dernierFait }))

  it('prend le bloc en cours ou vu dont le dernier fait est le plus récent', () => {
    const blocs = plan([
      ['B01', 'vu', apres(DEBUT, 1)],
      ['B02', 'en_cours', apres(DEBUT, 3)],
      ['B03', 'acquis', apres(DEBUT, 9)],
      ['B04', 'non_commence', null],
    ])
    expect(blocEnCours(blocs)).toBe('B02')
  })

  it('départage deux faits au même instant par l’ordre du plan', () => {
    const blocs = plan([
      ['B01', 'vu', DEBUT],
      ['B02', 'en_cours', DEBUT],
    ])
    expect(blocEnCours(blocs)).toBe('B01')
  })

  it('prend à défaut le premier bloc non commencé dans l’ordre du plan', () => {
    const blocs = plan([
      ['B01', 'acquis', apres(DEBUT, 1)],
      ['B02', 'non_commence', null],
      ['B03', 'non_commence', null],
    ])
    expect(blocEnCours(blocs)).toBe('B02')
  })

  it('rend null quand il n’y a plus rien à commencer', () => {
    expect(blocEnCours(plan([['B01', 'acquis', DEBUT]]))).toBeNull()
    expect(blocEnCours([])).toBeNull()
  })

  it('ignore un bloc en cours ou vu sans fait daté', () => {
    const blocs = plan([
      ['B01', 'en_cours', null],
      ['B02', 'non_commence', null],
    ])
    expect(blocEnCours(blocs)).toBe('B02')
  })
})

describe('seances', () => {
  it('regroupe les faits séparés de moins de 30 minutes et date la séance par le jour de son premier fait', () => {
    const f = fabrique()
    const faits = [
      f.ouverture(apres(DEBUT, 0, 0)),
      f.ouverture(apres(DEBUT, 0, 29)),
      f.ouverture(apres(DEBUT, 0, 58)),
      f.ouverture(apres(DEBUT, 0, 88)),
    ]
    const resultat = seances(faits, REGLAGES)
    expect(resultat).toHaveLength(2)
    expect(resultat[0]).toMatchObject({
      debut: apres(DEBUT, 0, 0),
      fin: apres(DEBUT, 0, 58),
      jour: '2026-06-01',
    })
    expect(resultat[0]?.faits).toEqual(['f0001', 'f0002', 'f0003'])
    expect(resultat[1]).toMatchObject({ debut: apres(DEBUT, 0, 88), fin: apres(DEBUT, 0, 88) })
  })

  it('ne dépend pas de l’ordre d’entrée, et ignore les doublons', () => {
    const f = fabrique()
    const a = f.ouverture(DEBUT)
    const b = f.ouverture(apres(DEBUT, 0, 10))
    expect(seances([b, a, a], REGLAGES)).toEqual(seances([a, b], REGLAGES))
  })

  it('sépare deux faits écartés d’exactement 30 minutes', () => {
    const f = fabrique()
    expect(seances([f.ouverture(DEBUT), f.ouverture(apres(DEBUT, 0, 30))], REGLAGES)).toHaveLength(
      2,
    )
  })

  it('rattache une séance finie après minuit au jour où elle a commencé', () => {
    const f = fabrique()
    const soir = '2026-06-01T21:50:00Z'
    const resultat = seances([f.ouverture(soir), f.ouverture(apres(soir, 0, 20))], REGLAGES)
    expect(resultat).toHaveLength(1)
    expect(resultat[0]?.jour).toBe('2026-06-01')
  })

  it('rend une liste vide sans fait', () => {
    expect(seances([], REGLAGES)).toEqual([])
  })
})

describe('validiteVerification', () => {
  const comptent: ReponseVerification[] = [
    { type: 'tache', question: 'DT1', tour: 1, reussi: true, compte: true },
  ]

  it('est valable sans page ouverte avant et sans réponse qui ne compte pas', () => {
    const f = fabrique()
    const debut = apres(DEBUT, 5)
    const faits = [f.ouverture(apres(DEBUT, 3))]
    expect(validiteVerification(faits, debut, comptent, REGLAGES)).toEqual({
      valable: true,
      raison: null,
    })
  })

  it('refuse une vérification quand la page du bloc a été ouverte moins de 24 h avant', () => {
    const f = fabrique()
    const debut = apres(DEBUT, 5)
    const faits = [f.ouverture(apres(debut, 0, -23 * 60))]
    expect(validiteVerification(faits, debut, comptent, REGLAGES)).toEqual({
      valable: false,
      raison: 'revu_avant',
    })
  })

  it('refuse une page ouverte pile 24 h avant le début, accepte juste avant la fenêtre ou après le début', () => {
    const f = fabrique()
    const debut = apres(DEBUT, 5)
    const limite = [f.ouverture(apres(debut, -1))]
    expect(validiteVerification(limite, debut, comptent, REGLAGES).raison).toBe('revu_avant')
    const dehors = [f.ouverture(apres(debut, -1, -1))]
    expect(validiteVerification(dehors, debut, comptent, REGLAGES).valable).toBe(true)
    const apresDebut = [f.ouverture(apres(debut, 0, 1))]
    expect(validiteVerification(apresDebut, debut, comptent, REGLAGES).valable).toBe(true)
  })

  it('ignore les faits qui ne sont pas une ouverture de page', () => {
    const f = fabrique()
    const debut = apres(DEBUT, 5)
    const faits = [f.etape(apres(debut, 0, -10), 'ET1')]
    expect(validiteVerification(faits, debut, comptent, REGLAGES).valable).toBe(true)
  })

  it('suit le réglage des heures sans page', () => {
    const f = fabrique()
    const debut = apres(DEBUT, 5)
    const faits = [f.ouverture(apres(debut, 0, -3 * 60))]
    const reglages = { ...REGLAGES, heuresSansPageAvantVerification: 2 }
    expect(validiteVerification(faits, debut, comptent, reglages).valable).toBe(true)
  })

  it('refuse une vérification qui contient une réponse qui ne compte pas', () => {
    const reponses: ReponseVerification[] = [
      ...comptent,
      { type: 'transfert', question: 'DR1', tour: 1, niveau: 'solide', compte: false },
    ]
    expect(validiteVerification([], apres(DEBUT, 5), reponses, REGLAGES)).toEqual({
      valable: false,
      raison: 'avec_support',
    })
  })

  it('donne la page revue avant l’aide quand les deux arrivent', () => {
    const f = fabrique()
    const debut = apres(DEBUT, 5)
    const reponses: ReponseVerification[] = [
      { type: 'tache', question: 'DT1', tour: 1, reussi: true, compte: false },
    ]
    const resultat = validiteVerification([f.ouverture(debut)], debut, reponses, REGLAGES)
    expect(resultat.raison).toBe('revu_avant')
  })
})
