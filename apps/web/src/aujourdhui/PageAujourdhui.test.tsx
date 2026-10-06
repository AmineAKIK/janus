import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { creerRouteur } from '../routes/arbre.tsx'
import { creerContexteTest } from '../routes/contexteTest.tsx'
import { dateLongue, texteRetour } from './textes.ts'

async function afficher() {
  const banc = creerContexteTest()
  const routeur = creerRouteur(createMemoryHistory({ initialEntries: ['/'] }), banc.contexte)
  await act(async () => {
    render(banc.application(routeur))
    await routeur.load()
  })
  await screen.findByRole('heading', { level: 2, name: 'Ton module' })
  return banc
}

describe('Aujourd’hui', () => {
  it('donne la date longue sans passer par l’horloge', () => {
    expect(dateLongue('2026-10-06')).toBe('mardi 6 octobre')
    expect(dateLongue('2026-01-01')).toBe('jeudi 1 janvier')
  })

  it('montre la prochaine étape, la progression et le programme', async () => {
    await afficher()

    expect(screen.getByRole('heading', { level: 1, name: 'Aujourd’hui' })).toBeVisible()
    expect(screen.getByText(/Prochaine étape · 1 sur/)).toBeVisible()
    expect(screen.getByRole('progressbar', { name: 'Progression' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Commencer la séance' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: 'Au programme' })).toBeVisible()
  })

  it('affiche la grille du module et la légende des 7 statuts', async () => {
    await afficher()

    const grille = screen.getByRole('list', { name: 'Blocs du module' })
    expect(within(grille).getAllByRole('link')).toHaveLength(20)
    expect(screen.getByRole('list', { name: 'Légende des statuts' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Voir le tableau de bord' })).toBeVisible()
  })

  it('annonce le retour après une absence', () => {
    expect(texteRetour(10)).toBe(
      'Tu reviens après 10 jours. On commence par ce qui est en retard, puis le bloc en cours.',
    )
  })
})
