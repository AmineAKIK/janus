import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { creerRouteur } from '../routes/arbre.tsx'
import { creerContexteTest } from '../routes/contexteTest.tsx'

async function afficher(chemin: string) {
  const banc = creerContexteTest()
  const routeur = creerRouteur(createMemoryHistory({ initialEntries: [chemin] }), banc.contexte)
  await act(async () => {
    render(banc.application(routeur))
    await routeur.load()
  })
  await screen.findByRole('heading', { level: 1, name: 'Module 1' })
  await screen.findAllByRole('heading', { level: 2 })
  return { ...banc, routeur }
}

function ligne(code: string): HTMLElement {
  const trouve = screen
    .getAllByRole('link')
    .find((lien) => within(lien).queryByText(code, { exact: true }) !== null)
  if (trouve === undefined) throw new Error(`Aucune ligne pour ${code}`)
  return trouve
}

describe('Blocs d’un module', () => {
  it('titre, fil d’Ariane, description et répartition', async () => {
    await afficher('/modules/M1')

    expect(screen.getByRole('heading', { level: 1, name: 'Module 1' })).toBeVisible()
    const fil = screen.getByRole('navigation', { name: 'Fil d’Ariane' })
    expect(within(fil).getByRole('link', { name: 'DWWM' })).toHaveAttribute(
      'href',
      '/formations/DWWM',
    )
    expect(
      screen.getByText(
        'Les bases de la machine, du réseau, du poste de travail et de la sécurité.',
      ),
    ).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('20 blocs')
  })

  it('regroupe les blocs par partie avec la plage de codes', async () => {
    await afficher('/modules/M1')

    expect(
      screen.getByRole('heading', { level: 2, name: 'P1 Machine et logique (B01–B04)' }),
    ).toBeVisible()
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(5)
  })

  // Avec la graine : B02 vérification due, B03 en cours (restitution), B04 erreur ouverte,
  // B05 vu, B07 vérification à venir, B01 et B06 acquis.
  it.each([
    ['B02', 'vérification aujourd’hui'],
    ['B03', 'restitution à faire'],
    ['B04', 'à reprendre'],
  ])('la carte de %s annonce « %s »', async (code, texte) => {
    await afficher('/modules/M1')

    expect(ligne(code)).toHaveTextContent(texte)
  })

  it('B04 montre le libellé de son erreur ouverte', async () => {
    await afficher('/modules/M1')

    expect(ligne('B04')).toHaveTextContent('Confond compilateur et interpréteur.')
  })

  it('un bloc dont les prérequis manquent annonce le premier manquant et reste cliquable', async () => {
    await afficher('/modules/M1')

    expect(ligne('B08')).toHaveTextContent(/prérequis : B0\d/)
    expect(ligne('B08')).toHaveAttribute('href')
  })

  it('le filtre « À reprendre » ne garde que les blocs à reprendre et suit le compteur', async () => {
    const utilisateur = userEvent.setup()
    const { routeur } = await afficher('/modules/M1')

    await utilisateur.click(screen.getByRole('radio', { name: 'À reprendre' }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('1 bloc')
    })
    expect(routeur.state.location.search).toEqual({ statut: 'a_reprendre' })
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1)
    expect(screen.queryByText('B01', { exact: true })).not.toBeInTheDocument()
  })

  it('recharger avec ?statut= et ?detail= donne le même affichage', async () => {
    await afficher('/modules/M1?statut=a_reprendre&detail=B04')

    expect(screen.getByRole('radio', { name: 'À reprendre' })).toBeChecked()
    expect(ligne('B04')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('status')).toHaveTextContent('1 bloc')
  })

  it('un clic sur un bloc le met dans l’adresse (?detail=)', async () => {
    const utilisateur = userEvent.setup()
    const { routeur } = await afficher('/modules/M1')

    await utilisateur.click(ligne('B05'))

    await waitFor(() => {
      expect(routeur.state.location.search).toEqual({ detail: 'B05' })
    })
  })
})
