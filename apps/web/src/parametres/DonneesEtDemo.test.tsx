import { ROUTES } from '@janus/contrats'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { etatGraine } from '../demo/graine.ts'
import { creerOutilsDemo } from '../demo/outils.ts'
import { creerRouteur } from '../routes/arbre.tsx'
import { creerContexteTest } from '../routes/contexteTest.tsx'

async function afficher(section: string) {
  const banc = creerContexteTest()
  window.__janusDemo = creerOutilsDemo({
    magasin: banc.magasin,
    horloge: banc.horloge,
    graine: etatGraine,
  })
  const routeur = creerRouteur(
    createMemoryHistory({ initialEntries: [`/parametres/${section}`] }),
    banc.contexte,
  )
  await act(async () => {
    render(banc.application(routeur))
    await routeur.load()
  })
  return banc
}

afterEach(() => {
  delete window.__janusDemo
  vi.unstubAllGlobals()
})

describe('Données', () => {
  it('exporte toutes les données en JSON', async () => {
    const utilisateur = userEvent.setup()
    const adresses: Blob[] = []
    vi.stubGlobal('URL', {
      createObjectURL: (blob: Blob) => {
        adresses.push(blob)
        return 'blob:export'
      },
      revokeObjectURL: () => undefined,
    })
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    await afficher('donnees')

    expect(await screen.findByText('Fiches, réponses, réglages et historique · JSON')).toBeVisible()
    await utilisateur.click(screen.getByRole('button', { name: 'Exporter' }))

    await waitFor(() => {
      expect(clic).toHaveBeenCalledOnce()
    })
    const [export_] = adresses
    expect(JSON.parse((await export_?.text()) ?? '{}')).toMatchObject({
      version: 1,
      donnees: { reglages: { questionsDebut: 6 } },
    })
    clic.mockRestore()
  })
})

describe('Zone sensible', () => {
  it('exige le mot de passe avant de supprimer', async () => {
    const utilisateur = userEvent.setup()
    const banc = await afficher('zone')
    await utilisateur.click(await screen.findByRole('button', { name: 'Supprimer mon compte' }))
    const dialogue = await screen.findByRole('dialog', { name: 'Supprimer mon compte ?' })
    expect(within(dialogue).getByText('Avant de continuer')).toBeVisible()
    expect(
      within(dialogue).getByText('Exporte tes données si tu souhaites en garder une copie.'),
    ).toBeVisible()

    await utilisateur.click(
      within(dialogue).getByRole('button', { name: 'Supprimer définitivement' }),
    )
    expect(await within(dialogue).findByText('Ce champ est obligatoire.')).toBeVisible()
    await utilisateur.type(within(dialogue).getByLabelText('Mot de passe'), 'faux')
    await utilisateur.click(
      within(dialogue).getByRole('button', { name: 'Supprimer définitivement' }),
    )

    expect(await within(dialogue).findByText('Le mot de passe est incorrect.')).toBeVisible()
    expect(banc.magasin.lire().faits.length).toBeGreaterThan(0)
  })

  it('supprime le compte : stockage vide et retour à la connexion', async () => {
    const utilisateur = userEvent.setup()
    const banc = await afficher('zone')
    await utilisateur.click(await screen.findByRole('button', { name: 'Supprimer mon compte' }))
    const dialogue = await screen.findByRole('dialog', { name: 'Supprimer mon compte ?' })

    await utilisateur.type(within(dialogue).getByLabelText('Mot de passe'), 'demo-janus')
    await utilisateur.click(
      within(dialogue).getByRole('button', { name: 'Supprimer définitivement' }),
    )

    await waitFor(() => {
      expect(window.location.hash).toBe('#/connexion')
    })
    expect(banc.magasin.lire().faits).toEqual([])
    expect(banc.magasin.lire().sessionOuverte).toBe(false)
  })
})

describe('Démo', () => {
  it('avance de 3 jours : l’heure affichée suit et Aujourd’hui montre les échéances passées', async () => {
    const utilisateur = userEvent.setup()
    const banc = await afficher('demo')
    const avant = await banc.transport.appeler(ROUTES['GET /aujourdhui'], {})
    const heure = await screen.findByText(/^Heure de démo/)
    const debut = heure.textContent

    await utilisateur.click(screen.getByRole('button', { name: 'Avancer de 3 jours' }))

    await waitFor(() => {
      expect(screen.getByText(/^Heure de démo/).textContent).not.toBe(debut)
    })
    expect(banc.horloge.decalageMs()).toBe(3 * 86_400_000)
    const apres = await banc.transport.appeler(ROUTES['GET /aujourdhui'], {})
    expect(Date.parse(apres.jour) - Date.parse(avant.jour)).toBe(3 * 86_400_000)
    const echeances = (taches: typeof avant.taches) =>
      taches.filter(({ tache }) => tache.type === 'verification').length
    expect(echeances(apres.taches)).toBeGreaterThanOrEqual(echeances(avant.taches))
  })

  it('allume un interrupteur et remet la démo à zéro', async () => {
    const utilisateur = userEvent.setup()
    const banc = await afficher('demo')

    await utilisateur.click(await screen.findByRole('switch', { name: 'Réseau lent' }))
    expect(banc.magasin.lire().interrupteurs.reseauLent).toBe(true)
    await utilisateur.click(screen.getByRole('button', { name: 'Compte vide' }))

    await waitFor(() => {
      expect(banc.magasin.lire().faits).toEqual([])
    })
    expect(banc.magasin.lire().interrupteurs.reseauLent).toBe(false)
  })
})
