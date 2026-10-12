import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { describe, expect, it, vi } from 'vitest'
import { DialogueConfirmation } from './DialogueConfirmation.tsx'

function afficher(danger: boolean) {
  const surConfirmer = vi.fn()
  const surAnnuler = vi.fn()
  render(
    <DialogueConfirmation
      titre="Se déconnecter ?"
      libelleConfirmer="Se déconnecter"
      danger={danger}
      surConfirmer={surConfirmer}
      surAnnuler={surAnnuler}
    >
      <p>Tu devras te reconnecter.</p>
    </DialogueConfirmation>,
  )
  return { surConfirmer, surAnnuler }
}

describe('DialogueConfirmation', () => {
  it('explique l’action et confirme ou annule', async () => {
    const utilisateur = userEvent.setup()
    const { surConfirmer, surAnnuler } = afficher(false)
    expect(screen.getByRole('dialog', { name: 'Se déconnecter ?' })).toBeVisible()
    expect(screen.getByText('Tu devras te reconnecter.')).toBeVisible()

    await utilisateur.click(screen.getByRole('button', { name: 'Se déconnecter' }))
    expect(surConfirmer).toHaveBeenCalledOnce()
    await utilisateur.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(surAnnuler).toHaveBeenCalledOnce()
  })

  it('met le focus sur la confirmation, ou sur « Annuler » quand l’action est dangereuse', () => {
    afficher(false)
    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toHaveFocus()
  })

  it('met le focus sur « Annuler » pour une action dangereuse', () => {
    afficher(true)
    expect(screen.getByRole('button', { name: 'Annuler' })).toHaveFocus()
  })

  it('Échap annule', async () => {
    const utilisateur = userEvent.setup()
    const { surConfirmer, surAnnuler } = afficher(true)
    await utilisateur.keyboard('{Escape}')
    expect(surAnnuler).toHaveBeenCalledOnce()
    expect(surConfirmer).not.toHaveBeenCalled()
  })

  it('est accessible', async () => {
    afficher(true)
    expect(await axe(document.body, { rules: { region: { enabled: false } } })).toHaveNoViolations()
  })
})
