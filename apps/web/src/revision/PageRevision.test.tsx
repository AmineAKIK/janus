import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { creerRouteur } from '../routes/arbre.tsx'
import { creerContexteTest } from '../routes/contexteTest.tsx'
import { texteIntervalle, texteProchaine, texteRepartition } from './textes.ts'

async function afficher() {
  const banc = creerContexteTest({ delaiCorrectionMs: 0 })
  const routeur = creerRouteur(
    createMemoryHistory({ initialEntries: ['/revision'] }),
    banc.contexte,
  )
  await act(async () => {
    render(banc.application(routeur))
    await routeur.load()
  })
  await screen.findByRole('button', { name: 'Voir la réponse' })
  return banc
}

describe('texteIntervalle', () => {
  it('passe des minutes aux heures, aux jours puis aux mois', () => {
    expect(texteIntervalle(60_000)).toBe('1 min')
    expect(texteIntervalle(10 * 60_000)).toBe('10 min')
    expect(texteIntervalle(3 * 3_600_000)).toBe('3 h')
    expect(texteIntervalle(4 * 86_400_000)).toBe('4 j')
    expect(texteIntervalle(30 * 86_400_000)).toBe('30 j')
    expect(texteIntervalle(95 * 86_400_000)).toBe('3 mois')
  })
})

describe('texteRepartition', () => {
  it('compte la dernière note de chaque carte, avec les accords', () => {
    expect(
      texteRepartition([
        { note: 'a_revoir' },
        { note: 'bien' },
        { note: 'bien' },
        { note: 'facile' },
      ]),
    ).toBe('1 à revoir, 0 difficile, 2 bien, 1 facile')
    expect(texteRepartition([{ note: 'difficile' }, { note: 'difficile' }])).toBe(
      '0 à revoir, 2 difficiles, 0 bien, 0 facile',
    )
  })
})

describe('texteProchaine', () => {
  it('dit « demain » ou la date courte', () => {
    expect(texteProchaine('2026-10-07', 1)).toBe('La prochaine arrive demain')
    expect(texteProchaine('2026-10-08', 2)).toBe('La prochaine arrive le 8 oct.')
  })
})

describe('Révision', () => {
  it('montre le recto, puis la réponse et les quatre notes avec leur intervalle', async () => {
    const utilisateur = userEvent.setup()
    await afficher()
    expect(screen.queryByRole('button', { name: /À revoir/ })).toBeNull()

    await utilisateur.click(screen.getByRole('button', { name: 'Voir la réponse' }))

    for (const nom of ['À revoir', 'Difficile', 'Bien', 'Facile']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${nom}`) })).toBeVisible()
    }
    expect(screen.getByRole('button', { name: /^Bien \d+ (min|h|j|mois)$/ })).toBeVisible()
  })

  it('la barre d’espace montre la réponse et 3 note « Bien »', async () => {
    const utilisateur = userEvent.setup()
    await afficher()

    await utilisateur.keyboard(' ')
    await screen.findByRole('button', { name: /^Bien/ })
    await utilisateur.keyboard('3')

    await screen.findByText(/^Notée Bien · revient dans/)
  })

  it('« Annuler » remet la carte au recto sans envoyer la note', async () => {
    const utilisateur = userEvent.setup()
    const banc = await afficher()
    const envois: unknown[] = []
    const appeler = banc.transport.appeler.bind(banc.transport)
    banc.transport.appeler = (route: never, entree: never, options: never) => {
      envois.push(route)
      return appeler(route, entree, options)
    }

    await utilisateur.keyboard(' ')
    await utilisateur.keyboard('2')
    await utilisateur.click(await screen.findByRole('button', { name: 'Annuler' }))

    await screen.findByRole('button', { name: 'Voir la réponse' })
    expect(screen.queryByText(/^Notée/)).toBeNull()
    expect(JSON.stringify(envois)).not.toContain('/note')
  })

  it('quitter envoie la note en attente', async () => {
    const utilisateur = userEvent.setup()
    const banc = await afficher()
    await utilisateur.keyboard(' ')
    await utilisateur.keyboard('4')
    await screen.findByText(/^Notée Facile/)
    expect(Object.keys(banc.magasin.lire().cartes)).toHaveLength(0)

    await utilisateur.keyboard('{Escape}')
    const dialogue = await screen.findByRole('dialog', { name: 'Quitter la séance ?' })
    await utilisateur.click(within(dialogue).getByRole('button', { name: 'Quitter' }))

    await waitFor(() => {
      expect(Object.keys(banc.magasin.lire().cartes)).toHaveLength(1)
    })
  })

  it('termine la file par « N cartes revues » et « Étape suivante »', async () => {
    const utilisateur = userEvent.setup()
    await afficher()
    const rang = screen.getByText(/ sur \d+ · dont \d+ nouvelle/).textContent
    const total = Number(/ sur (\d+)/.exec(rang)?.[1])

    for (let carte = 0; carte < total; carte += 1) {
      await utilisateur.keyboard(' ')
      await utilisateur.keyboard('3')
    }

    await screen.findByRole('heading', { name: new RegExp(`^${String(total)} cartes? revues?$`) })
    expect(
      screen.getByText(`0 à revoir, 0 difficile, ${String(total)} bien, 0 facile`),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: /^Étape suivante/ })).toBeVisible()
  })
})
