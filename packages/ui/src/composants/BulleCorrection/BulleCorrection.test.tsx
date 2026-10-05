import { Niveau, Source } from '@janus/contrats'
import { render, screen } from '@testing-library/react'
import { axe } from '../../tests/axe.ts'
import { describe, expect, it } from 'vitest'
import { BulleCorrection } from './BulleCorrection.tsx'

const NIVEAUX_LIBELLES = {
  solide: 'Solide',
  partiel: 'Partiel',
  fragile: 'Fragile',
  pas_encore: 'Pas encore',
}
const SOURCES_LIBELLES = {
  support: 'D’après le cours',
  deduit: 'Déduit du cours',
  ajoute: 'Ajouté hors du cours',
}

describe('BulleCorrection', () => {
  it.each(Niveau.options)('affiche le niveau %s', (niveau) => {
    render(<BulleCorrection niveau={niveau} message="Message" source="support" />)
    expect(screen.getByText(NIVEAUX_LIBELLES[niveau])).toBeInTheDocument()
  })

  it.each(Source.options)('affiche la source %s', (source) => {
    render(<BulleCorrection niveau="solide" message="Message" source={source} />)
    expect(screen.getByText(SOURCES_LIBELLES[source])).toBeInTheDocument()
  })

  it('affiche du HTML comme du texte', () => {
    const { container } = render(
      <BulleCorrection niveau="fragile" message="Utilise <b>gras</b> ici" source="support" />,
    )
    expect(container.querySelector('b')).toBeNull()
    expect(screen.getByText('Utilise <b>gras</b> ici')).toBeInTheDocument()
  })

  it('garde les retours à la ligne', () => {
    render(<BulleCorrection niveau="solide" message={'Ligne 1\nLigne 2'} source="support" />)
    expect(screen.getByText(/Ligne 1/).textContent).toBe('Ligne 1\nLigne 2')
  })

  it('affiche « À vérifier » seulement si non vérifié', () => {
    const { rerender } = render(<BulleCorrection niveau="solide" message="M" source="ajoute" />)
    expect(screen.queryByText('À vérifier')).not.toBeInTheDocument()
    rerender(<BulleCorrection niveau="solide" message="M" source="ajoute" nonVerifie />)
    expect(screen.getByText('À vérifier')).toBeInTheDocument()
  })

  it('affiche les actions reçues', () => {
    render(
      <BulleCorrection
        niveau="partiel"
        message="M"
        source="deduit"
        enfants={<button type="button">Relancer</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'Relancer' })).toBeInTheDocument()
  })

  it.each(Niveau.options)("n'a aucune violation d'accessibilité en %s", async (niveau) => {
    const { container } = render(
      <BulleCorrection niveau={niveau} message="Message" source="support" nonVerifie />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
