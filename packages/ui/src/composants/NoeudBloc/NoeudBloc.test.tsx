import { Statut } from '@janus/contrats'
import { render, screen } from '@testing-library/react'
import { axe } from '../../tests/axe.ts'
import { describe, expect, it } from 'vitest'
import type { ProprietesLien } from '../../utilitaires/lien.ts'
import { NoeudBloc } from './NoeudBloc.tsx'

const lien = ({ className, children }: ProprietesLien) => (
  <a href="#cible" className={className}>
    {children}
  </a>
)

describe('NoeudBloc', () => {
  it.each(Statut.options)('affiche le statut %s', (statut) => {
    render(<NoeudBloc code="B01" libelle="Machine" statut={statut} lien={lien} />)
    expect(screen.getByRole('link')).toHaveTextContent('B01')
    expect(screen.getByRole('link')).toHaveTextContent('Machine')
  })

  it('dit le statut aux lecteurs d’écran', () => {
    render(<NoeudBloc code="B01" libelle="Machine" statut="maitrise" lien={lien} />)
    expect(screen.getByRole('link')).toHaveTextContent('Maîtrisé')
  })

  it('est un seul lien', () => {
    render(<NoeudBloc code="B01" libelle="Machine" statut="vu" lien={lien} />)
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it("n'a aucune violation d'accessibilité", async () => {
    const { container } = render(
      <NoeudBloc code="B01" libelle="Machine" statut="a_reprendre" lien={lien} />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
