import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from '../../tests/axe.ts'
import { Dialogue } from './Dialogue.tsx'

function Exemple({ surFermeture = () => undefined }: { readonly surFermeture?: () => void }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOuvert(true)
        }}
      >
        Ouvrir
      </button>
      {ouvert && (
        <Dialogue
          titre="Prérequis manquant"
          surFermeture={() => {
            surFermeture()
            setOuvert(false)
          }}
        >
          <label>
            Raison
            <input />
          </label>
          <button type="button">Valider</button>
        </Dialogue>
      )}
    </>
  )
}

describe('Dialogue', () => {
  it('est une fenêtre modale nommée par son titre, le premier champ a le focus', async () => {
    const utilisateur = userEvent.setup()
    render(<Exemple />)

    await utilisateur.click(screen.getByRole('button', { name: 'Ouvrir' }))

    const dialogue = screen.getByRole('dialog', { name: 'Prérequis manquant' })
    expect(dialogue).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByLabelText('Raison')).toHaveFocus()
  })

  it('piège le focus : Tab et Maj+Tab bouclent dans la fenêtre', async () => {
    const utilisateur = userEvent.setup()
    render(<Exemple />)
    await utilisateur.click(screen.getByRole('button', { name: 'Ouvrir' }))

    await utilisateur.tab()
    expect(screen.getByRole('button', { name: 'Valider' })).toHaveFocus()
    await utilisateur.tab()
    expect(screen.getByRole('button', { name: 'Fermer' })).toHaveFocus()
    await utilisateur.tab()
    expect(screen.getByLabelText('Raison')).toHaveFocus()
    await utilisateur.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Fermer' })).toHaveFocus()
  })

  it('Échap ferme et rend le focus à l’élément qui l’a ouverte', async () => {
    const utilisateur = userEvent.setup()
    const fermeture = vi.fn()
    render(<Exemple surFermeture={fermeture} />)
    await utilisateur.click(screen.getByRole('button', { name: 'Ouvrir' }))

    await utilisateur.keyboard('{Escape}')

    expect(fermeture).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ouvrir' })).toHaveFocus()
  })

  it('la croix ferme aussi', async () => {
    const utilisateur = userEvent.setup()
    render(<Exemple />)
    await utilisateur.click(screen.getByRole('button', { name: 'Ouvrir' }))

    await utilisateur.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('n’a aucune violation d’accessibilité', async () => {
    const utilisateur = userEvent.setup()
    const { baseElement } = render(<Exemple />)
    await utilisateur.click(screen.getByRole('button', { name: 'Ouvrir' }))

    expect(await axe(baseElement)).toHaveNoViolations()
  })
})
