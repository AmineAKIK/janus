import { describe, expect, it } from 'vitest'
import { etapeSuivante, titreCourtDuBloc } from './etapeSuivante.ts'
import type { Aujourdhui } from './etapeSuivante.ts'

const aujourdhui = (taches: Aujourdhui['taches']): Aujourdhui => ({
  jour: '2026-10-12',
  en_retard: false,
  premiere_connexion: false,
  module: null,
  taches,
})

const QUESTIONS = {
  tache: { type: 'questions_debut', nombre: 3 },
  faite: false,
  lien: '/questions',
} as const
const CARTES = {
  tache: { type: 'cartes', dues: 2, nouvelles: 0 },
  faite: false,
  lien: '/revision',
} as const

describe('titreCourtDuBloc', () => {
  const blocs = [{ bloc: 'B03', titre_court: 'Les fiches' }]

  it('donne le titre court du bloc', () => {
    expect(titreCourtDuBloc(blocs, 'B03')).toBe('Les fiches')
  })

  it('reste vide quand le bloc ou la liste est inconnu', () => {
    expect(titreCourtDuBloc(blocs, 'B09')).toBe('')
    expect(titreCourtDuBloc(undefined, 'B03')).toBe('')
  })
})

describe('etapeSuivante', () => {
  it('ramène à l’accueil sans tâche à faire', () => {
    expect(etapeSuivante(undefined, () => false)).toEqual({ lien: '/', libelle: 'Étape suivante' })
    expect(etapeSuivante(aujourdhui([{ ...CARTES, faite: true }]), () => false)).toEqual({
      lien: '/',
      libelle: 'Étape suivante',
    })
  })

  it('mène à la première tâche pas encore faite, avec son titre', () => {
    const etape = etapeSuivante(aujourdhui([{ ...QUESTIONS, faite: true }, CARTES]), () => false)

    expect(etape.lien).toBe('/revision')
    expect(etape.libelle).toMatch(/^Étape suivante : .+/)
  })

  it('laisse de côté les tâches que la séance en cours écarte', () => {
    const etape = etapeSuivante(
      aujourdhui([QUESTIONS, CARTES]),
      ({ tache }) => tache.type === 'questions_debut',
    )

    expect(etape.lien).toBe('/revision')
  })
})
