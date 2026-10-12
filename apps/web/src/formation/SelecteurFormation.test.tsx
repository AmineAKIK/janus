import { ROUTES } from '@janus/contrats'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { creerRouteur } from '../routes/arbre.tsx'
import { creerContexteTest } from '../routes/contexteTest.tsx'

async function afficher(deuxFormations: boolean) {
  const banc = creerContexteTest()
  if (deuxFormations) {
    banc.magasin.ecrire((etat) => ({
      ...etat,
      interrupteurs: { ...etat.interrupteurs, deuxFormations: true },
    }))
  }
  const routeur = creerRouteur(createMemoryHistory({ initialEntries: ['/'] }), banc.contexte)
  await act(async () => {
    render(banc.application(routeur))
    await routeur.load()
  })
  return banc
}

describe('sélecteur de formation', () => {
  it('ne s’affiche pas avec une seule formation', async () => {
    await afficher(false)
    await waitFor(() => {
      expect(screen.queryByRole('combobox', { name: 'Formation' })).toBeNull()
    })
  })

  it('change la formation active, qui se retrouve dans les réglages et dans la liste', async () => {
    const banc = await afficher(true)
    const choix = await screen.findByRole('combobox', { name: 'Formation' })
    const { formations } = await banc.transport.appeler(ROUTES['GET /formations'], {})
    const autre = formations.find(({ active }) => !active)
    expect(autre).toBeDefined()

    await userEvent.click(choix)
    await userEvent.click(await screen.findByRole('option', { name: autre?.titre ?? '' }))

    await waitFor(async () => {
      const apres = await banc.transport.appeler(ROUTES['GET /formations'], {})
      expect(apres.formations.find(({ active }) => active)?.id).toBe(autre?.id)
    })
  })
})
