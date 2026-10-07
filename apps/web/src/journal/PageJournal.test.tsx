import { nouvelId, ROUTES } from '@janus/contrats'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { creerRouteur } from '../routes/arbre.tsx'
import { creerContexteTest } from '../routes/contexteTest.tsx'

async function afficher(chemin = '/journal', banc = creerContexteTest()) {
  const routeur = creerRouteur(createMemoryHistory({ initialEntries: [chemin] }), banc.contexte)
  await act(async () => {
    render(banc.application(routeur))
    await routeur.load()
  })
  await screen.findByRole('heading', { level: 2, name: 'État des blocs' })
  return { banc, routeur }
}

function simulerEcran(mql: boolean) {
  window.matchMedia = (requete: string) =>
    ({
      matches: mql,
      media: requete,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList
}

describe('Journal', () => {
  it('montre les lignes par jour, l’état des blocs et les exports', async () => {
    simulerEcran(true)
    await afficher()

    expect(screen.getByRole('heading', { level: 1, name: 'Journal' })).toBeVisible()
    const etat = screen.getByRole('region', { name: 'État des blocs' })
    expect(within(etat).getByRole('link', { name: 'B01 · Acquis' })).toHaveAttribute(
      'href',
      '#/blocs/B01',
    )
    expect(screen.getAllByRole('heading', { level: 3 }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Exporter en texte' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Exporter en JSON' })).toBeVisible()
  })

  it('filtre par bloc dans l’adresse, avec la puce « B04 × » qui le retire', async () => {
    simulerEcran(true)
    const { routeur } = await afficher('/journal?bloc=B04')

    expect(screen.getByRole('button', { name: 'Retirer le filtre B04' })).toHaveTextContent('B04 ×')
    const lignes = screen.getAllByRole('button', { expanded: false })
    expect(lignes.some((bouton) => bouton.textContent.includes('B04'))).toBe(true)
    expect(lignes.every((bouton) => !bouton.textContent.includes('B05'))).toBe(true)

    await userEvent.click(screen.getByRole('button', { name: 'Retirer le filtre B04' }))
    await waitFor(() => {
      expect(routeur.state.location.search).toEqual({})
    })
  })

  it('choisit un type dans les puces et le garde dans l’adresse', async () => {
    simulerEcran(true)
    const { routeur } = await afficher()
    const types = screen.getByRole('group', { name: 'Type' })

    await userEvent.click(within(types).getByRole('button', { name: 'Vérifications' }))

    await waitFor(() => {
      expect(routeur.state.location.search).toEqual({ type: 'verification' })
    })
    expect(
      await screen.findByRole('button', { name: 'Retirer le filtre Vérifications' }),
    ).toBeVisible()
  })

  it('ignore un type inconnu de l’adresse', async () => {
    simulerEcran(true)
    await afficher('/journal?type=secret')

    expect(screen.queryByRole('button', { name: /Retirer le filtre/ })).toBeNull()
  })

  it('dit que le journal est vide pour ces filtres, ou qu’il se remplira', async () => {
    simulerEcran(true)
    await afficher('/journal?bloc=B20&type=contestation')

    expect(screen.getByText('Rien dans le journal pour ces filtres.')).toBeVisible()
  })

  it('affiche le badge tant qu’une contestation attend un tranchage', async () => {
    simulerEcran(true)
    const banc = creerContexteTest({ delaiCorrectionMs: 0 })
    const correction = await banc.transport.appeler(ROUTES['POST /corrections'], {
      corps: {
        id: nouvelId(30),
        serie: 'restitution',
        tentative: 1,
        question: 'R1',
        reponse: 'Réponse attendue : Que contient une fiche . Et voilà mes propres mots.',
        confiance: 'sur',
        relance: '',
        support: { colle: false, retour_cours: false },
        bloc: 'B08',
        version: 1,
      },
    })
    await banc.transport.appeler(ROUTES['POST /corrections'], {
      corps: {
        id: nouvelId(31),
        serie: 'restitution',
        tentative: 1,
        question: 'R1',
        reponse: 'Réponse attendue : Que contient une fiche . Et voilà mes propres mots.',
        confiance: 'sur',
        relance: 'Je conteste ta correction : mon raisonnement suit bien le cours.',
        support: { colle: false, retour_cours: false },
        conteste: true,
        bloc: 'B08',
        version: 1,
      },
    })

    await afficher('/journal?bloc=B08&type=contestation', banc)

    expect(screen.getByText('Contestation en attente')).toBeVisible()
    expect(screen.getByText('R1 · correction contestée')).toBeVisible()
    expect(correction.id).toBeTruthy()
  })

  it('déplie une ligne pour ouvrir le bloc, et ajoute puis modifie une note', async () => {
    simulerEcran(true)
    await afficher('/journal?bloc=B04&type=erreur_critique')
    const utilisateur = userEvent.setup()

    const [ligne] = screen.getAllByRole('button', { expanded: false })
    if (ligne === undefined) throw new Error('Aucune ligne')
    await utilisateur.click(ligne)
    expect(screen.getByRole('link', { name: 'Ouvrir le bloc' })).toHaveAttribute(
      'href',
      '#/blocs/B04',
    )

    await utilisateur.click(screen.getByRole('button', { name: '+ Ajouter une note' }))
    await utilisateur.type(screen.getByLabelText('Ta note'), 'Je confonds encore.')
    await utilisateur.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Je confonds encore.')).toBeVisible()
    await utilisateur.click(screen.getByRole('button', { name: 'Modifier' }))
    await utilisateur.clear(screen.getByLabelText('Ta note'))
    await utilisateur.type(screen.getByLabelText('Ta note'), 'Plus clair.')
    await utilisateur.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText('Plus clair.')).toBeVisible()
  })

  it('ajoute une idée dans « À explorer plus tard »', async () => {
    simulerEcran(true)
    await afficher()
    const utilisateur = userEvent.setup()

    await utilisateur.click(screen.getByText('À explorer plus tard'))
    await utilisateur.type(screen.getByLabelText('Ajouter une idée'), 'Un mode révision rapide.')
    await utilisateur.click(screen.getByRole('button', { name: 'Ajouter' }))

    expect(await screen.findByText('Un mode révision rapide.')).toBeVisible()
  })

  it('sur mobile, « Filtres · N » ouvre les puces Bloc et Type avec « Tout effacer »', async () => {
    simulerEcran(false)
    const { routeur } = await afficher('/journal?bloc=B04')
    const utilisateur = userEvent.setup()

    await utilisateur.click(screen.getByRole('button', { name: 'Filtres · 1' }))
    const feuille = screen.getByRole('dialog', { name: 'Filtres' })
    const blocs = within(feuille).getByRole('group', { name: 'Bloc' })
    const types = within(feuille).getByRole('group', { name: 'Type' })
    expect(within(blocs).getByRole('button', { name: 'B04' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(types).getByRole('button', { name: 'Tous' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await utilisateur.click(within(feuille).getByRole('button', { name: 'Tout effacer' }))
    await waitFor(() => {
      expect(routeur.state.location.search).toEqual({})
    })
    expect(await screen.findByRole('button', { name: 'Filtres · 0' })).toBeVisible()
  })
})
