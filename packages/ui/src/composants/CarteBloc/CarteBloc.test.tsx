import { Statut } from '@janus/contrats'
import { render, screen } from '@testing-library/react'
import { axe } from '../../tests/axe.ts'
import { describe, expect, it } from 'vitest'
import type { ProprietesLien } from '../../utilitaires/lien.ts'
import { CarteBloc } from './CarteBloc.tsx'

const lien = ({ className, children }: ProprietesLien) => (
  <a href="#cible" className={className}>
    {children}
  </a>
)

const TITRE_LONG =
  'Comprendre les fermetures et la portée des variables dans une fonction imbriquée'

describe('CarteBloc', () => {
  it.each(Statut.options)('affiche le statut %s', (statut) => {
    render(
      <CarteBloc
        code="JS-04"
        titre="Fermetures"
        statut={statut}
        prochaineDate={null}
        lien={lien}
      />,
    )
    expect(screen.getByText('JS-04')).toBeInTheDocument()
    expect(screen.getByText('Fermetures')).toBeInTheDocument()
  })

  it('est un seul lien, sans lien imbriqué', () => {
    render(
      <CarteBloc
        code="JS-04"
        titre="Fermetures"
        statut="vu"
        prochaineDate="12 octobre"
        lien={lien}
      />,
    )
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('affiche la prochaine date seulement quand elle existe', () => {
    const { rerender } = render(
      <CarteBloc code="A" titre="T" statut="vu" prochaineDate="12 octobre" lien={lien} />,
    )
    expect(screen.getByText('Prochaine révision · 12 octobre')).toBeInTheDocument()
    rerender(<CarteBloc code="A" titre="T" statut="vu" prochaineDate={null} lien={lien} />)
    expect(screen.queryByText(/Prochaine révision/)).not.toBeInTheDocument()
  })

  it('mentionne les prérequis manquants quand elle est grisée, et reste cliquable', () => {
    render(
      <CarteBloc code="A" titre="T" statut="non_commence" prochaineDate={null} grise lien={lien} />,
    )
    expect(screen.getByText('Prérequis manquants')).toBeInTheDocument()
    expect(screen.getByRole('link')).toBeInTheDocument()
  })

  it("n'affiche pas la mention hors état grisé", () => {
    render(<CarteBloc code="A" titre="T" statut="vu" prochaineDate={null} lien={lien} />)
    expect(screen.queryByText('Prérequis manquants')).not.toBeInTheDocument()
  })

  it('accepte un titre long', () => {
    render(<CarteBloc code="A" titre={TITRE_LONG} statut="vu" prochaineDate={null} lien={lien} />)
    expect(screen.getByText(TITRE_LONG)).toBeInTheDocument()
  })

  it("n'a aucune violation d'accessibilité", async () => {
    const { container } = render(
      <CarteBloc
        code="JS-04"
        titre="Fermetures"
        statut="acquis"
        prochaineDate="12 octobre"
        grise
        lien={lien}
      />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
