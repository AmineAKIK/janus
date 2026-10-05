import { render, screen } from '@testing-library/react'
import { axe } from '../../tests/axe.ts'
import { describe, expect, it } from 'vitest'
import { ChangementStatut } from './ChangementStatut.tsx'

describe('ChangementStatut', () => {
  it("affiche l'heure, le bloc et les deux statuts", () => {
    render(
      <ChangementStatut
        heure="10:12"
        bloc="B04 Boucles"
        avant="acquis_provisoirement"
        apres="acquis"
      />,
    )
    expect(screen.getByText('10:12')).toBeInTheDocument()
    expect(screen.getByText('B04 Boucles')).toBeInTheDocument()
    expect(screen.getByText('Acquis provisoirement')).toBeInTheDocument()
    expect(screen.getByText('Acquis')).toBeInTheDocument()
  })

  it('dit le sens du changement aux lecteurs d’écran', () => {
    render(<ChangementStatut heure="10:12" bloc="B04" avant="vu" apres="acquis" />)
    expect(screen.getByText('devient')).toBeInTheDocument()
  })

  it('affiche la raison seulement quand elle est fournie', () => {
    const { rerender } = render(
      <ChangementStatut heure="10:12" bloc="B04" avant="vu" apres="acquis" />,
    )
    expect(screen.queryByText('Statut forcé')).not.toBeInTheDocument()
    rerender(
      <ChangementStatut heure="10:12" bloc="B04" avant="vu" apres="acquis" raison="Statut forcé" />,
    )
    expect(screen.getByText('Statut forcé')).toBeInTheDocument()
  })

  it("n'a aucune violation d'accessibilité", async () => {
    const { container } = render(
      <ChangementStatut
        heure="10:12"
        bloc="B04"
        avant="vu"
        apres="a_reprendre"
        raison="Erreur critique"
      />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
