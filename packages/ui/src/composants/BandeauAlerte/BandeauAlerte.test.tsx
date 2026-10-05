import { render, screen } from '@testing-library/react'
import { axe } from '../../tests/axe.ts'
import { describe, expect, it } from 'vitest'
import { BandeauAlerte, type TypeBandeau } from './BandeauAlerte.tsx'

const TYPES: readonly TypeBandeau[] = ['erreur', 'info', 'succes', 'avertissement']

describe('BandeauAlerte', () => {
  it.each(TYPES)('affiche son contenu en type %s', (type) => {
    render(<BandeauAlerte type={type}>Réponse enregistrée.</BandeauAlerte>)
    expect(screen.getByText('Réponse enregistrée.')).toBeInTheDocument()
  })

  it('utilise role="alert" pour une erreur', () => {
    render(<BandeauAlerte type="erreur">Impossible d’enregistrer la réponse.</BandeauAlerte>)
    expect(screen.getByRole('alert')).toHaveTextContent('Impossible d’enregistrer la réponse.')
  })

  it.each(['info', 'succes', 'avertissement'] as const)('utilise role="status" pour %s', (type) => {
    render(<BandeauAlerte type={type}>Message</BandeauAlerte>)
    expect(screen.getByRole('status')).toHaveTextContent('Message')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each(TYPES)("n'a aucune violation d'accessibilité en %s", async (type) => {
    const { container } = render(<BandeauAlerte type={type}>Message</BandeauAlerte>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
