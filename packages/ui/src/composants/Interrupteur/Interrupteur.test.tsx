import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from '../../tests/axe.ts'
import { LigneReglage } from '../LigneReglage/LigneReglage.tsx'
import { Interrupteur } from './Interrupteur.tsx'

function Controle() {
  const [coche, setCoche] = useState(false)
  return <Interrupteur aria-label="Rappel quotidien" coche={coche} onChange={setCoche} />
}

describe('Interrupteur', () => {
  it('est un interrupteur dont aria-checked suit la valeur', () => {
    const { rerender } = render(
      <Interrupteur aria-label="Rappel" coche={false} onChange={vi.fn()} />,
    )
    expect(screen.getByRole('switch', { name: 'Rappel' })).toHaveAttribute('aria-checked', 'false')

    rerender(<Interrupteur aria-label="Rappel" coche onChange={vi.fn()} />)
    expect(screen.getByRole('switch', { name: 'Rappel' })).toHaveAttribute('aria-checked', 'true')
  })

  it('bascule au clic', async () => {
    const auChangement = vi.fn()
    render(<Interrupteur aria-label="Rappel" coche={false} onChange={auChangement} />)

    await userEvent.setup().click(screen.getByRole('switch'))

    expect(auChangement).toHaveBeenCalledWith(true)
  })

  it('bascule au clavier avec Espace, puis revient avec Entrée', async () => {
    const utilisateur = userEvent.setup()
    render(<Controle />)

    await utilisateur.tab()
    expect(screen.getByRole('switch')).toHaveFocus()
    await utilisateur.keyboard(' ')
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    await utilisateur.keyboard('{Enter}')
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('désactivé, il ne bascule pas', async () => {
    const auChangement = vi.fn()
    render(<Interrupteur aria-label="Rappel" coche={false} onChange={auChangement} disabled />)

    await userEvent.setup().click(screen.getByRole('switch'))

    expect(auChangement).not.toHaveBeenCalled()
  })

  it('prend son nom et son aide de la ligne de réglage qui le contient', () => {
    render(
      <LigneReglage
        libelle="Rappel quotidien"
        aide="Une notification par jour"
        controle={<Interrupteur coche={false} onChange={vi.fn()} />}
      />,
    )
    const interrupteur = screen.getByRole('switch', { name: 'Rappel quotidien' })
    expect(interrupteur).toHaveAccessibleDescription('Une notification par jour')
  })

  it('n’a aucune violation d’accessibilité', async () => {
    const { container } = render(
      <LigneReglage
        libelle="Rappel quotidien"
        aide="Une notification par jour"
        controle={<Interrupteur coche onChange={vi.fn()} />}
      />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
