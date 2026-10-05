import { describe, expect, it } from 'vitest'
import type { NoteCarte } from '@janus/contrats'
import { carteDue, carteNeuve, cartesDuJour, noterCarte } from './cartes.ts'
import type { CarteDuBloc, EtatCarte } from './cartes.ts'
import { apres, DEBUT, REGLAGES } from './fabrique.ts'
import { instantEnIso, instantEnMs } from './temps.ts'

const ms = (iso: string) => instantEnMs(iso)

/** Une carte déjà en révision : plusieurs « bien » au moment où elle est due. */
function carteEnRevision(reglages = REGLAGES): EtatCarte {
  let etat = carteNeuve(DEBUT)
  for (let i = 0; i < 4; i += 1) etat = noterCarte(etat, 'bien', etat.echeance, reglages)
  return etat
}

describe('carteNeuve', () => {
  it('est due tout de suite, jamais révisée', () => {
    const etat = carteNeuve(DEBUT)
    expect(etat).toMatchObject({
      phase: 'nouvelle',
      repetitions: 0,
      oublis: 0,
      derniereRevision: null,
    })
    expect(ms(etat.echeance)).toBe(ms(DEBUT))
  })
})

describe('noterCarte', () => {
  it('programme la révision suivante après la date de la note, et la garde en mémoire', () => {
    const neuve = carteNeuve(DEBUT)
    const notee = noterCarte(neuve, 'bien', DEBUT, REGLAGES)
    expect(notee.repetitions).toBe(1)
    expect(ms(notee.echeance)).toBeGreaterThan(ms(DEBUT))
    expect(notee.derniereRevision).toBe(instantEnIso(ms(DEBUT)))
    expect(neuve.repetitions).toBe(0)
  })

  it('espace plus les révisions quand la note est meilleure', () => {
    const etat = carteEnRevision()
    const quand = etat.echeance
    const notes: NoteCarte[] = ['a_revoir', 'difficile', 'bien', 'facile']
    const echeances = notes.map((note) => ms(noterCarte(etat, note, quand, REGLAGES).echeance))
    expect(echeances).toEqual([...echeances].sort((a, b) => a - b))
    expect(new Set(echeances).size).toBe(4)
  })

  it('compte un oubli sur une carte en révision', () => {
    const etat = carteEnRevision()
    expect(noterCarte(etat, 'a_revoir', etat.echeance, REGLAGES).oublis).toBe(etat.oublis + 1)
  })

  it('espace plus quand la rétention visée est plus basse', () => {
    const basse = { ...REGLAGES, retentionVisee: 0.8 }
    const haute = { ...REGLAGES, retentionVisee: 0.97 }
    const etatBasse = carteEnRevision(basse)
    const etatHaute = carteEnRevision(haute)
    const intervalle = (etat: EtatCarte, reglages: typeof REGLAGES) =>
      ms(noterCarte(etat, 'bien', etat.echeance, reglages).echeance) - ms(etat.echeance)
    expect(intervalle(etatBasse, basse)).toBeGreaterThan(intervalle(etatHaute, haute))
  })

  it('donne le même résultat pour les mêmes entrées', () => {
    const etat = carteEnRevision()
    expect(noterCarte(etat, 'difficile', etat.echeance, REGLAGES)).toEqual(
      noterCarte(etat, 'difficile', etat.echeance, REGLAGES),
    )
  })
})

describe('carteDue', () => {
  it('est due à partir de sa date', () => {
    const etat = carteEnRevision()
    expect(carteDue(etat, apres(etat.echeance, 0, -1))).toBe(false)
    expect(carteDue(etat, etat.echeance)).toBe(true)
    expect(carteDue(etat, apres(etat.echeance, 3))).toBe(true)
  })
})

describe('cartesDuJour', () => {
  const vue = (id: string, bloc: string, etat: EtatCarte | null): CarteDuBloc => ({
    id,
    bloc,
    etat,
  })
  const due = (jours: number) => {
    const etat = carteEnRevision()
    return { ...etat, echeance: apres(DEBUT, 100 + jours) }
  }
  const maintenant = apres(DEBUT, 110)

  it('ne propose que les cartes des blocs vus', () => {
    const cartes = [vue('a', 'B01', due(0)), vue('b', 'B02', due(0)), vue('c', 'B02', null)]
    const jour = cartesDuJour({
      cartes,
      blocsVus: ['B01'],
      nouvellesDejaIntroduites: 0,
      maintenant,
      reglages: REGLAGES,
    })
    expect(jour).toEqual({ dues: ['a'], nouvelles: [] })
  })

  it('range les cartes dues de la plus en retard à la moins en retard, sans aucune limite', () => {
    const cartes = Array.from({ length: 60 }, (_, i) =>
      vue(`c${String(i).padStart(2, '0')}`, 'B01', due(-i % 7)),
    )
    const jour = cartesDuJour({
      cartes,
      blocsVus: ['B01'],
      nouvellesDejaIntroduites: 99,
      maintenant,
      reglages: REGLAGES,
    })
    expect(jour.dues).toHaveLength(60)
    expect(jour.dues[0]).toBe('c06')
    expect(jour.nouvelles).toEqual([])
  })

  it('range à égalité de date par identifiant', () => {
    const cartes = [vue('b', 'B01', due(0)), vue('a', 'B01', due(0))]
    const jour = cartesDuJour({
      cartes,
      blocsVus: ['B01'],
      nouvellesDejaIntroduites: 0,
      maintenant,
      reglages: REGLAGES,
    })
    expect(jour.dues).toEqual(['a', 'b'])
  })

  it('ne propose pas une carte qui n’est pas encore due', () => {
    const cartes = [vue('a', 'B01', due(20))]
    expect(
      cartesDuJour({
        cartes,
        blocsVus: ['B01'],
        nouvellesDejaIntroduites: 0,
        maintenant,
        reglages: REGLAGES,
      }).dues,
    ).toEqual([])
  })

  it('plafonne les nouvelles cartes par jour, en tenant compte de celles déjà introduites', () => {
    const cartes = Array.from({ length: 30 }, (_, i) => vue(`n${String(i)}`, 'B01', null))
    const entree = { cartes, blocsVus: ['B01'], maintenant, reglages: REGLAGES }
    expect(cartesDuJour({ ...entree, nouvellesDejaIntroduites: 0 }).nouvelles).toHaveLength(20)
    expect(cartesDuJour({ ...entree, nouvellesDejaIntroduites: 15 }).nouvelles).toEqual([
      'n0',
      'n1',
      'n2',
      'n3',
      'n4',
    ])
    expect(cartesDuJour({ ...entree, nouvellesDejaIntroduites: 20 }).nouvelles).toEqual([])
    expect(cartesDuJour({ ...entree, nouvellesDejaIntroduites: 25 }).nouvelles).toEqual([])
    const zero = { ...REGLAGES, nouvellesCartesParJour: 0 }
    expect(
      cartesDuJour({ ...entree, reglages: zero, nouvellesDejaIntroduites: 0 }).nouvelles,
    ).toEqual([])
  })
})
