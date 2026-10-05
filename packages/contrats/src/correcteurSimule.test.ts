import { describe, expect, it } from 'vitest'
import {
  corrigerSimule,
  DELAI_CORRECTION_SIMULEE_MS,
  PREFIXE_CORRECTION_SIMULEE,
} from './correcteurSimule.ts'

const ATTENDU = 'Une fiche résume un seul bloc avec une carte, des exercices et un bilan.'
const LONGUE = 'Une fiche rassemble une carte, quelques exercices et un bilan pour un seul bloc.'

describe('corrigerSimule', () => {
  it('refuse une réponse vide ou faite d’espaces', () => {
    for (const reponse of ['', '   \n ']) {
      expect(corrigerSimule(reponse, ATTENDU)).toMatchObject({ refusee: true })
    }
  })

  it('« je ne sais pas » donne pas_encore avec un indice, sans tenir compte de la casse', () => {
    for (const reponse of ['je ne sais pas', 'Je NE sais PAS.', '  Je ne sais pas !  ']) {
      const correction = corrigerSimule(reponse, ATTENDU)

      expect(correction).toMatchObject({ refusee: false, niveau: 'pas_encore' })
      expect(!correction.refusee && correction.indice).toMatch(/^Indice : pense à « /)
    }
  })

  it('moins de 40 caractères donne fragile', () => {
    expect(corrigerSimule('Une fiche résume un bloc.', ATTENDU)).toMatchObject({
      niveau: 'fragile',
    })
    expect(corrigerSimule('x'.repeat(39), ATTENDU)).toMatchObject({ niveau: 'fragile' })
  })

  it('au moins la moitié des mots de plus de 4 lettres de l’attendu donne solide', () => {
    expect(corrigerSimule(LONGUE, ATTENDU)).toMatchObject({ niveau: 'solide' })
  })

  it('compte sans tenir compte des accents ni de la casse', () => {
    expect(
      corrigerSimule('UNE FICHE RESUME UN SEUL BLOC AVEC UNE CARTE ET UN BILAN', ATTENDU),
    ).toMatchObject({
      niveau: 'solide',
    })
  })

  it('sinon donne partiel', () => {
    const correction = corrigerSimule(
      'Le texte est assez long mais parle d’autre chose, vraiment.',
      ATTENDU,
    )

    expect(correction).toMatchObject({ refusee: false, niveau: 'partiel' })
  })

  it('commence chaque message par le préfixe de la démo', () => {
    for (const reponse of [
      '',
      'je ne sais pas',
      'court',
      LONGUE,
      'Un texte long qui ne dit rien de précis ici.',
    ]) {
      expect(corrigerSimule(reponse, ATTENDU).message.startsWith(PREFIXE_CORRECTION_SIMULEE)).toBe(
        true,
      )
    }
    expect(PREFIXE_CORRECTION_SIMULEE).toBe('Correction simulée (démo) : ')
  })

  it('est déterministe et simule 800 ms de délai', () => {
    expect(corrigerSimule(LONGUE, ATTENDU)).toEqual(corrigerSimule(LONGUE, ATTENDU))
    expect(DELAI_CORRECTION_SIMULEE_MS).toBe(800)
  })

  it('juge solide un attendu sans mot significatif, dès que la réponse est assez longue', () => {
    expect(
      corrigerSimule('Oui, c’est bien ce que dit le cours, je confirme.', 'Oui.'),
    ).toMatchObject({
      niveau: 'solide',
    })
  })
})
