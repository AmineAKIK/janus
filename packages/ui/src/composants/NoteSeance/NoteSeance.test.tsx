import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from '../../tests/axe.ts'
import { describe, expect, it, vi } from 'vitest'
import { NoteSeance } from './NoteSeance.tsx'

const base = { compris: '', bloque: '', onChangeCompris: vi.fn(), onChangeBloque: vi.fn() }

describe('NoteSeance', () => {
  it('est repliée par défaut avec aria-expanded', () => {
    render(<NoteSeance {...base} />)
    expect(screen.getByRole('button', { name: /Ma note/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.getByText('Ce que j’ai compris')).not.toBeVisible()
  })

  it('se déplie et se replie au clavier', async () => {
    const utilisateur = userEvent.setup()
    render(<NoteSeance {...base} />)
    await utilisateur.tab()
    await utilisateur.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: /Ma note/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Ce que j’ai compris')).toBeVisible()
    expect(screen.getByLabelText('Ce qui bloque encore')).toBeVisible()
    await utilisateur.keyboard(' ')
    expect(screen.getByRole('button', { name: /Ma note/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('remonte le texte saisi', async () => {
    const onChangeCompris = vi.fn()
    render(<NoteSeance {...base} onChangeCompris={onChangeCompris} deplieParDefaut />)
    await userEvent.setup().type(screen.getByLabelText('Ce que j’ai compris'), 'a')
    expect(onChangeCompris).toHaveBeenCalledWith('a')
  })

  it('affiche « Enregistré » seulement quand c’est le cas', () => {
    const { rerender } = render(<NoteSeance {...base} />)
    expect(screen.queryByText('Enregistré')).not.toBeInTheDocument()
    rerender(<NoteSeance {...base} enregistre />)
    expect(screen.getByRole('status')).toHaveTextContent('Enregistré')
  })

  it.each([false, true])("n'a aucune violation d'accessibilité (dépliée : %s)", async (deplie) => {
    const { container } = render(<NoteSeance {...base} enregistre deplieParDefaut={deplie} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
