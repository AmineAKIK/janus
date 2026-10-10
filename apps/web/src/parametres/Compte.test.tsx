import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PREMIER_LANCEMENT } from '../demo/routes/banc.ts'
import { creerRouteur } from '../routes/arbre.tsx'
import { creerContexteTest } from '../routes/contexteTest.tsx'

async function afficher() {
  const banc = creerContexteTest()
  const routeur = creerRouteur(
    createMemoryHistory({ initialEntries: ['/parametres/compte'] }),
    banc.contexte,
  )
  await act(async () => {
    render(banc.application(routeur))
    await routeur.load()
  })
  await screen.findByText('Nom d’utilisateur')
  return banc
}

async function ouvrirDialogue(utilisateur: ReturnType<typeof userEvent.setup>) {
  await utilisateur.click(screen.getByRole('button', { name: 'Changer le mot de passe' }))
  return screen.findByRole('dialog', { name: 'Changer le mot de passe' })
}

describe('Compte', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('montre le nom d’utilisateur en lecture seule et l’heure de bascule par défaut', async () => {
    await afficher()

    expect(screen.getByText('amine')).toBeVisible()
    expect(screen.getByLabelText('Heure de bascule du jour')).toHaveValue('4')
    expect(screen.getByRole('combobox', { name: 'Fuseau horaire' })).toHaveValue('Europe/Paris')
  })

  it('change le fuseau horaire', async () => {
    const utilisateur = userEvent.setup()
    const banc = await afficher()

    await utilisateur.selectOptions(
      screen.getByRole('combobox', { name: 'Fuseau horaire' }),
      'Europe/Lisbon',
    )

    await waitFor(() => {
      expect(banc.magasin.lire().reglages.fuseau).toBe('Europe/Lisbon')
    })
  })

  it('refuse un nouveau mot de passe trop court ou une confirmation différente', async () => {
    const utilisateur = userEvent.setup()
    const banc = await afficher()
    const dialogue = await ouvrirDialogue(utilisateur)

    await utilisateur.type(within(dialogue).getByLabelText('Mot de passe actuel'), 'demo-janus')
    await utilisateur.type(within(dialogue).getByLabelText('Nouveau mot de passe'), 'court')
    await utilisateur.type(
      within(dialogue).getByLabelText('Confirmation du nouveau mot de passe'),
      'autre',
    )
    await utilisateur.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }))

    expect(
      await within(dialogue).findByText('Le mot de passe doit faire au moins 12 caractères.'),
    ).toBeVisible()
    expect(
      within(dialogue).getByText('Les deux mots de passe ne sont pas identiques.'),
    ).toBeVisible()
    expect(banc.magasin.lire().motDePasse).toBe('demo-janus')
  })

  it('refuse plus de 72 octets', async () => {
    const utilisateur = userEvent.setup()
    await afficher()
    const dialogue = await ouvrirDialogue(utilisateur)
    const long = 'é'.repeat(37)

    await utilisateur.type(within(dialogue).getByLabelText('Mot de passe actuel'), 'demo-janus')
    await utilisateur.type(within(dialogue).getByLabelText('Nouveau mot de passe'), long)
    await utilisateur.type(
      within(dialogue).getByLabelText('Confirmation du nouveau mot de passe'),
      long,
    )
    await utilisateur.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }))

    expect(
      await within(dialogue).findByText('Le mot de passe doit faire 72 octets au plus.'),
    ).toBeVisible()
  })

  it('dit quand le mot de passe actuel est faux', async () => {
    const utilisateur = userEvent.setup()
    await afficher()
    const dialogue = await ouvrirDialogue(utilisateur)

    await utilisateur.type(within(dialogue).getByLabelText('Mot de passe actuel'), 'mauvais')
    await utilisateur.type(
      within(dialogue).getByLabelText('Nouveau mot de passe'),
      'un-nouveau-secret',
    )
    await utilisateur.type(
      within(dialogue).getByLabelText('Confirmation du nouveau mot de passe'),
      'un-nouveau-secret',
    )
    await utilisateur.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }))

    expect(await within(dialogue).findByText('Le mot de passe actuel est incorrect.')).toBeVisible()
  })

  it('change le mot de passe puis ferme la boîte', async () => {
    const utilisateur = userEvent.setup()
    const banc = await afficher()
    const dialogue = await ouvrirDialogue(utilisateur)

    await utilisateur.type(within(dialogue).getByLabelText('Mot de passe actuel'), 'demo-janus')
    await utilisateur.type(
      within(dialogue).getByLabelText('Nouveau mot de passe'),
      'un-nouveau-secret',
    )
    await utilisateur.type(
      within(dialogue).getByLabelText('Confirmation du nouveau mot de passe'),
      'un-nouveau-secret',
    )
    await utilisateur.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Mot de passe changé.')).toBeVisible()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(banc.magasin.lire().motDePasse).toBe('un-nouveau-secret')
  })

  it('liste les sessions et déconnecte une autre session, jamais la courante', async () => {
    // Les sessions de la démo sont datées depuis le premier lancement : le temps réel est figé juste après.
    vi.useFakeTimers({ toFake: ['Date'], now: Date.parse(PREMIER_LANCEMENT) + 60_000 })
    const utilisateur = userEvent.setup()
    const banc = await afficher()
    const liste = await screen.findByRole('region', { name: 'Sessions ouvertes' })

    expect(await within(liste).findByText(/· Cet appareil/)).toBeVisible()
    expect(within(liste).getAllByRole('button', { name: /^Déconnecter/ })).toHaveLength(2)
    expect(
      within(liste).getByText(/^Dernière activité : il y a \d+ h$/, { selector: 'p' }),
    ).toBeVisible()

    await utilisateur.click(
      within(liste).getByRole('button', { name: 'Déconnecter Pixel 8 · Chrome' }),
    )

    await waitFor(() => {
      expect(banc.magasin.lire().sessions).toHaveLength(1)
    })
    expect(await within(liste).findAllByRole('button', { name: /^Déconnecter/ })).toHaveLength(1)
  })

  it('« Se déconnecter » ferme la session et mène à la connexion', async () => {
    const utilisateur = userEvent.setup()
    const banc = await afficher()

    await utilisateur.click(screen.getByRole('button', { name: 'Se déconnecter' }))

    await waitFor(() => {
      expect(banc.magasin.lire().sessionOuverte).toBe(false)
    })
  })
})
