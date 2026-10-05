import { Statut as SchemaStatut, type Statut } from '@janus/contrats'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from '../../tests/axe.ts'
import { describe, expect, it } from 'vitest'
import { BadgeStatut, LIBELLES_STATUT } from './BadgeStatut.tsx'

const ATTENDUS: Record<Statut, string> = {
  non_commence: 'Non commencé',
  en_cours: 'En cours',
  vu: 'Vu',
  acquis_provisoirement: 'Acquis provisoirement',
  acquis: 'Acquis',
  maitrise: 'Maîtrisé',
  a_reprendre: 'À reprendre',
}

describe('BadgeStatut', () => {
  it('couvre les 7 statuts avec les libellés exacts', () => {
    expect(Object.keys(LIBELLES_STATUT).sort()).toEqual([...SchemaStatut.options].sort())
    expect(LIBELLES_STATUT).toEqual(ATTENDUS)
  })

  it.each(SchemaStatut.options)('affiche le libellé de %s', (statut) => {
    render(<BadgeStatut statut={statut} />)
    expect(screen.getByText(ATTENDUS[statut])).toBeInTheDocument()
  })

  it('garde le libellé lisible en taille compacte', () => {
    render(<BadgeStatut statut="acquis" taille="compacte" />)
    expect(screen.getByText('Acquis')).toBeInTheDocument()
  })

  it("n'a pas d'infobulle par défaut", () => {
    render(<BadgeStatut statut="vu" />)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('relie la définition au badge avec aria-describedby', () => {
    render(<BadgeStatut statut="vu" infobulle />)
    const badge = screen.getByText('Vu').parentElement
    expect(badge).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id)
  })

  it('ouvre la définition au focus et la ferme avec Échap', async () => {
    const utilisateur = userEvent.setup()
    render(<BadgeStatut statut="vu" infobulle />)
    const infobulle = screen.getByRole('tooltip')
    expect(infobulle.className).not.toMatch(/ouverte/)
    await utilisateur.tab()
    expect(infobulle.className).toMatch(/ouverte/)
    await utilisateur.keyboard('{Escape}')
    expect(infobulle.className).not.toMatch(/ouverte/)
  })

  it('ouvre la définition au survol', async () => {
    const utilisateur = userEvent.setup()
    render(<BadgeStatut statut="acquis" infobulle />)
    await utilisateur.hover(screen.getByText('Acquis'))
    expect(screen.getByRole('tooltip').className).toMatch(/ouverte/)
    await utilisateur.unhover(screen.getByText('Acquis'))
    expect(screen.getByRole('tooltip').className).not.toMatch(/ouverte/)
  })

  it.each(SchemaStatut.options)("n'a aucune violation d'accessibilité en %s", async (statut) => {
    const { container } = render(<BadgeStatut statut={statut} infobulle />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
