import { render, screen } from '@testing-library/react'
import { axe } from '../../tests/axe.ts'
import { describe, expect, it } from 'vitest'
import type { ProprietesLien } from '../../utilitaires/lien.ts'
import { LigneAFaire } from './LigneAFaire.tsx'

const lien = ({ className, children }: ProprietesLien) => (
  <a href="#cible" className={className}>
    {children}
  </a>
)

describe('LigneAFaire', () => {
  it('affiche le type, le bloc et l’échéance', () => {
    render(<LigneAFaire type="Vérification" bloc="B03 Variables" echeance="8 oct." lien={lien} />)
    expect(screen.getByText('Vérification')).toBeInTheDocument()
    expect(screen.getByText('B03 Variables')).toBeInTheDocument()
    expect(screen.getByText('8 oct.')).toBeInTheDocument()
  })

  it('donne au lien un nom qui dit la tâche', () => {
    render(<LigneAFaire type="Vérification" bloc="B03 Variables" echeance="8 oct." lien={lien} />)
    expect(
      screen.getByRole('link', { name: /Commencer.*Vérification.*B03 Variables/ }),
    ).toBeInTheDocument()
  })

  it('ajoute « prioritaire » pour les lecteurs d’écran seulement si prioritaire', () => {
    const { rerender } = render(<LigneAFaire type="V" bloc="B03" echeance="8 oct." lien={lien} />)
    expect(screen.queryByText(/prioritaire/)).not.toBeInTheDocument()
    rerender(<LigneAFaire type="V" bloc="B03" echeance="8 oct." prioritaire lien={lien} />)
    expect(screen.getByText(/prioritaire/)).toBeInTheDocument()
  })

  it("n'a aucune violation d'accessibilité", async () => {
    const { container } = render(
      <LigneAFaire
        type="Vérification"
        bloc="B03 Variables"
        echeance="8 oct."
        prioritaire
        lien={lien}
      />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
