import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { etapesFaites, FilEtapes } from './FilEtapes.tsx'

const ETAPES = [
  { id: 'ET1', titre: 'Carte' },
  { id: 'ET2', titre: 'Pré-test' },
  { id: 'ET3', titre: 'Explication' },
  { id: 'ET4', titre: 'Pratique' },
]

describe('etapesFaites', () => {
  it('compte comme faites les étapes avant la plus avancée vue', () => {
    expect(etapesFaites(ETAPES, ['ET1', 'ET3'])).toEqual(new Set(['ET1', 'ET2']))
  })

  it('n’en compte aucune tant que rien n’a été vu', () => {
    expect(etapesFaites(ETAPES, [])).toEqual(new Set())
  })

  it('ignore une étape inconnue', () => {
    expect(etapesFaites(ETAPES, ['ZZ'])).toEqual(new Set())
  })
})

describe('FilEtapes', () => {
  it('liste un onglet par étape, dans l’ordre, la première est courante par défaut', () => {
    render(<FilEtapes etapes={ETAPES} courante={null} vues={[]} surChoix={() => undefined} />)

    const onglets = screen.getAllByRole('button')
    expect(onglets.map((onglet) => onglet.textContent)).toEqual([
      'Carte',
      'Pré-test',
      'Explication',
      'Pratique',
    ])
    expect(onglets[0]).toHaveAttribute('aria-current', 'step')
    expect(onglets[1]).not.toHaveAttribute('aria-current')
  })

  it('préfixe les étapes faites par « ✓ » et marque la courante', () => {
    render(
      <FilEtapes
        etapes={ETAPES}
        courante="ET3"
        vues={['ET1', 'ET2', 'ET3']}
        surChoix={() => undefined}
      />,
    )

    expect(screen.getByRole('button', { name: 'Carte' }).textContent).toBe('✓ Carte')
    expect(screen.getByRole('button', { name: 'Pré-test' }).textContent).toBe('✓ Pré-test')
    expect(screen.getByRole('button', { name: 'Explication' })).toHaveAttribute(
      'aria-current',
      'step',
    )
    expect(screen.getByRole('button', { name: 'Explication' }).textContent).toBe('Explication')
  })

  it('demande l’étape cliquée', async () => {
    const choix = vi.fn()
    render(<FilEtapes etapes={ETAPES} courante={null} vues={[]} surChoix={choix} />)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Pratique' }))

    expect(choix).toHaveBeenCalledWith('ET4')
  })
})
