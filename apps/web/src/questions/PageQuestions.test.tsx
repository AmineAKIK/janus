import { ROUTES } from '@janus/contrats'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { creerRouteur } from '../routes/arbre.tsx'
import { creerContexteTest } from '../routes/contexteTest.tsx'
import { tronquer } from './textes.ts'

async function afficher(options: Parameters<typeof creerContexteTest>[0] = {}) {
  const banc = creerContexteTest({ delaiCorrectionMs: 0, ...options })
  const routeur = creerRouteur(
    createMemoryHistory({ initialEntries: ['/questions'] }),
    banc.contexte,
  )
  await act(async () => {
    render(banc.application(routeur))
    await routeur.load()
  })
  await screen.findByRole('button', { name: 'Faire corriger' })
  return banc
}

describe('Questions de début de séance', () => {
  it('« Faire corriger » n’est actif qu’avec une confiance et une réponse', async () => {
    const utilisateur = userEvent.setup()
    await afficher()
    const corriger = screen.getByRole('button', { name: 'Faire corriger' })
    expect(corriger).toBeDisabled()

    await utilisateur.type(screen.getByRole('textbox', { name: 'Ta réponse' }), 'Une réponse')
    expect(corriger).toBeDisabled()
    await utilisateur.click(screen.getByRole('radio', { name: 'Sûr' }))

    expect(corriger).toBeEnabled()
  })

  it('n’affiche aucun nom de bloc avant la correction', async () => {
    await afficher()

    expect(document.body.textContent).not.toMatch(/\bB\d{2}\b/)
  })

  it('« Je ne sais pas » envoie la réponse en confiance « au hasard » et affiche l’indice', async () => {
    const utilisateur = userEvent.setup()
    await afficher()

    await utilisateur.click(screen.getByRole('button', { name: 'Je ne sais pas' }))

    await screen.findByText('Tu as choisi « Je ne sais pas ».')
    expect(screen.getByRole('heading', { name: 'Indice' })).toBeVisible()
    expect(screen.getByText(/· tu étais au hasard/)).toBeVisible()
  })

  it('un collage met colle à vrai dans la demande', async () => {
    const utilisateur = userEvent.setup()
    const banc = await afficher()
    const envois: unknown[] = []
    const appeler = banc.transport.appeler.bind(banc.transport)
    banc.transport.appeler = (route: never, entree: never, options: never) => {
      envois.push(entree)
      return appeler(route, entree, options)
    }

    await utilisateur.click(screen.getByRole('textbox', { name: 'Ta réponse' }))
    await utilisateur.paste('Texte collé')
    await utilisateur.click(screen.getByRole('radio', { name: 'Hésitant' }))
    await utilisateur.click(screen.getByRole('button', { name: 'Faire corriger' }))

    await waitFor(() => {
      expect(JSON.stringify(envois)).toContain('"colle":true')
    })
  })

  it('la correction indisponible garde la réponse et propose de réessayer', async () => {
    const utilisateur = userEvent.setup()
    const banc = await afficher()
    banc.magasin.ecrire((etat) => ({
      ...etat,
      interrupteurs: { ...etat.interrupteurs, correctionIndisponible: true },
    }))

    await utilisateur.type(screen.getByRole('textbox', { name: 'Ta réponse' }), 'Ma réponse')
    await utilisateur.click(screen.getByRole('radio', { name: 'Sûr' }))
    await utilisateur.click(screen.getByRole('button', { name: 'Faire corriger' }))

    await screen.findByText('Correction indisponible pour l’instant. Ta réponse est gardée.')
    expect(screen.getByRole('textbox', { name: 'Ta réponse' })).toHaveValue('Ma réponse')
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeVisible()
  })

  it('une correction non vérifiée annonce « À vérifier »', async () => {
    const utilisateur = userEvent.setup()
    const banc = await afficher()
    banc.magasin.ecrire((etat) => ({
      ...etat,
      interrupteurs: { ...etat.interrupteurs, correctionNonVerifiee: true },
    }))

    await utilisateur.type(screen.getByRole('textbox', { name: 'Ta réponse' }), 'Ma réponse')
    await utilisateur.click(screen.getByRole('radio', { name: 'Sûr' }))
    await utilisateur.click(screen.getByRole('button', { name: 'Faire corriger' }))

    await screen.findByText('Le tuteur n’est pas sûr. Tu trancheras dans le bilan.')
  })

  it('quitter à la question 3 puis revenir reprend à la question 4', async () => {
    const utilisateur = userEvent.setup()
    const banc = await afficher()
    const { questions } = await banc.transport.appeler(ROUTES['GET /questions-debut'], {})
    for (const [rang, question] of questions.slice(0, 3).entries()) {
      await banc.transport.appeler(ROUTES['POST /corrections'], {
        corps: {
          id: `0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2${String(rang)}`,
          serie: 'rappel',
          tentative: 1,
          question: question.id,
          reponse: 'Je ne sais pas',
          confiance: 'hasard',
          relance: '',
          support: { colle: false, retour_cours: false },
        },
      })
    }
    banc.client.clear()
    const routeur = creerRouteur(
      createMemoryHistory({ initialEntries: ['/questions'] }),
      banc.contexte,
    )
    await act(async () => {
      render(banc.application(routeur))
      await routeur.load()
    })
    await screen.findByText(`4 sur ${String(questions.length)}`)

    await utilisateur.click(screen.getAllByRole('button', { name: /Quitter/ })[0] ?? document.body)
    expect(screen.getByRole('dialog', { name: 'Quitter la séance ?' })).toBeVisible()
    expect(
      screen.getByText('Tes réponses sont gardées. Tu pourras reprendre à la question 4.'),
    ).toBeVisible()
  })

  it('tronque l’énoncé à 48 caractères avec « … »', () => {
    expect(tronquer('a'.repeat(48))).toBe('a'.repeat(48))
    expect(tronquer('a'.repeat(49))).toBe(`${'a'.repeat(48)}…`)
  })
})
