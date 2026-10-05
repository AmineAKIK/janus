import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { axe } from '../../tests/axe.ts'
import { LigneLectureSeule } from './LigneLectureSeule.tsx'

describe('LigneLectureSeule', () => {
  it('associe le libellé à sa valeur', () => {
    render(<LigneLectureSeule libelle="Règle de la méthode" valeur="Valeur en lecture seule" />)
    expect(screen.getByText('Règle de la méthode').tagName).toBe('DT')
    expect(screen.getByText('Valeur en lecture seule').tagName).toBe('DD')
  })

  it('cache le cadenas aux lecteurs d’écran', () => {
    const { container } = render(<LigneLectureSeule libelle="Règle" valeur="3 jours" />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('n’a aucune violation d’accessibilité', async () => {
    const { container } = render(<LigneLectureSeule libelle="Règle" valeur="3 jours" />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
