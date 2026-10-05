import { describe, expect, it } from 'vitest'
import { apres, DEBUT, MANIFESTE, REGLAGES } from './fabrique.ts'
import { tirerDifferee } from './tirage.ts'

const MAINTENANT = apres(DEBUT, 100)

describe('tirerDifferee', () => {
  it('tire la première question jamais posée du type demandé', () => {
    expect(tirerDifferee(MANIFESTE, 'explication', [], MAINTENANT, REGLAGES)?.id).toBe('DE1')
    expect(tirerDifferee(MANIFESTE, 'tache', [], MAINTENANT, REGLAGES)?.id).toBe('DT1')
    expect(tirerDifferee(MANIFESTE, 'transfert', [], MAINTENANT, REGLAGES)?.id).toBe('DR1')
  })

  it('saute les questions déjà posées, quelle que soit leur date', () => {
    const deja = [
      { question: 'DE1', date: apres(DEBUT, 99) },
      { question: 'DE2', date: DEBUT },
      { question: 'DT1', date: DEBUT },
    ]
    expect(tirerDifferee(MANIFESTE, 'explication', deja, MAINTENANT, REGLAGES)?.id).toBe('DE3')
  })

  it('rend une question de la réserve épuisée quand elle date de 60 jours ou plus, la plus ancienne d’abord', () => {
    const deja = [
      { question: 'DE1', date: apres(DEBUT, 30) },
      { question: 'DE2', date: apres(DEBUT, 20) },
      { question: 'DE3', date: apres(DEBUT, 10) },
      { question: 'DE4', date: apres(DEBUT, 40) },
    ]
    expect(tirerDifferee(MANIFESTE, 'explication', deja, MAINTENANT, REGLAGES)?.id).toBe('DE3')
  })

  it('prend la plus récente des dates quand une question a été posée plusieurs fois', () => {
    const deja = [
      { question: 'DE1', date: DEBUT },
      { question: 'DE1', date: apres(DEBUT, 90) },
      { question: 'DE2', date: apres(DEBUT, 5) },
      { question: 'DE3', date: apres(DEBUT, 6) },
      { question: 'DE4', date: apres(DEBUT, 7) },
    ]
    expect(tirerDifferee(MANIFESTE, 'explication', deja, MAINTENANT, REGLAGES)?.id).toBe('DE2')
  })

  it('départage deux dates égales par l’ordre du manifeste', () => {
    const date = apres(DEBUT, 10)
    const deja = ['DE4', 'DE3', 'DE2', 'DE1'].map((question) => ({ question, date }))
    expect(tirerDifferee(MANIFESTE, 'explication', deja, MAINTENANT, REGLAGES)?.id).toBe('DE1')
  })

  it('rend null quand toute la réserve a été posée il y a moins de 60 jours', () => {
    const deja = ['DE1', 'DE2', 'DE3', 'DE4'].map((question) => ({
      question,
      date: apres(DEBUT, 41),
    }))
    expect(tirerDifferee(MANIFESTE, 'explication', deja, MAINTENANT, REGLAGES)).toBeNull()
  })

  it('compte 60 jours entiers, en jours de jourDe', () => {
    const deja = ['DE1', 'DE2', 'DE3', 'DE4'].map((question) => ({
      question,
      date: apres(DEBUT, 40),
    }))
    expect(tirerDifferee(MANIFESTE, 'explication', deja, MAINTENANT, REGLAGES)?.id).toBe('DE1')
    expect(
      tirerDifferee(MANIFESTE, 'explication', deja, apres(MAINTENANT, -1), REGLAGES),
    ).toBeNull()
  })

  it('suit le réglage des jours avant réutilisation', () => {
    const deja = ['DE1', 'DE2', 'DE3', 'DE4'].map((question) => ({
      question,
      date: apres(DEBUT, 95),
    }))
    expect(tirerDifferee(MANIFESTE, 'explication', deja, MAINTENANT, REGLAGES)).toBeNull()
    expect(
      tirerDifferee(MANIFESTE, 'explication', deja, MAINTENANT, {
        ...REGLAGES,
        joursAvantReutilisation: 5,
      })?.id,
    ).toBe('DE1')
  })

  it('rend null quand le manifeste n’a aucune question du type', () => {
    const sans = {
      ...MANIFESTE,
      differees: MANIFESTE.differees.filter(({ type }) => type !== 'tache'),
    }
    expect(tirerDifferee(sans, 'tache', [], MAINTENANT, REGLAGES)).toBeNull()
  })
})
