import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DialogueQuitterSeance } from './DialogueQuitterSeance.tsx'
import { EnteteSeance } from './EnteteSeance.tsx'

describe('EnteteSeance', () => {
  it('affiche « Quitter », le titre en h1 et ce que l’écran y ajoute', async () => {
    const surQuitter = vi.fn()
    render(
      <EnteteSeance titre="Révision" colonnes={undefined} surQuitter={surQuitter}>
        <p>1 / 3</p>
      </EnteteSeance>,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Révision' })).toBeVisible()
    expect(screen.getByText('1 / 3')).toBeVisible()
    await userEvent.setup().click(screen.getByRole('button', { name: /Quitter/ }))
    expect(surQuitter).toHaveBeenCalledTimes(1)
  })

  it('peut donner au titre un nom accessible plus long que le texte affiché', () => {
    render(
      <EnteteSeance
        titre="Questions"
        libelleTitre="Questions de début de séance"
        colonnes={undefined}
        surQuitter={() => undefined}
      />,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName(
      'Questions de début de séance',
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Questions')
  })
})

describe('DialogueQuitterSeance', () => {
  it('pose la question, met le focus sur « Continuer » et sépare rester de partir', async () => {
    const utilisateur = userEvent.setup()
    const surSortie = vi.fn()
    const surContinuer = vi.fn()
    render(
      <DialogueQuitterSeance
        titre="Quitter la séance ?"
        texte="Tes notes sont gardées."
        libelleSortie="Reprendre plus tard"
        surSortie={surSortie}
        surContinuer={surContinuer}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Quitter la séance ?' })).toBeVisible()
    expect(screen.getByText('Tes notes sont gardées.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Continuer' })).toHaveFocus()

    await utilisateur.click(screen.getByRole('button', { name: 'Reprendre plus tard' }))
    expect(surSortie).toHaveBeenCalledTimes(1)
    expect(surContinuer).not.toHaveBeenCalled()

    await utilisateur.click(screen.getByRole('button', { name: 'Continuer' }))
    expect(surContinuer).toHaveBeenCalledTimes(1)
  })

  it('appelle la sortie « Quitter » par défaut', () => {
    render(
      <DialogueQuitterSeance
        titre="Quitter ?"
        texte="Texte"
        surSortie={() => undefined}
        surContinuer={() => undefined}
      />,
    )

    expect(screen.getByRole('button', { name: 'Quitter' })).toBeVisible()
  })
})
