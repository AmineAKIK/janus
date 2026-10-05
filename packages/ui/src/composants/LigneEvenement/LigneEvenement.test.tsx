import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from '../../tests/axe.ts'
import { describe, expect, it } from 'vitest'
import { BadgeNeComptePas } from '../BadgeNeComptePas/BadgeNeComptePas.tsx'
import { LigneEvenement } from './LigneEvenement.tsx'

describe('LigneEvenement', () => {
  it("affiche l'heure, le titre et les précisions", () => {
    render(
      <LigneEvenement heure="09:24" titre="B07 · Restitution" precisions={['Hésitant · aide 0']} />,
    )
    expect(screen.getByText('09:24')).toBeInTheDocument()
    expect(screen.getByText('B07 · Restitution')).toBeInTheDocument()
    expect(screen.getByText('Hésitant · aide 0')).toBeInTheDocument()
  })

  it("n'est pas dépliable sans détail", () => {
    render(<LigneEvenement heure="09:24" titre="Titre" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('est repliée par défaut avec aria-expanded', () => {
    render(<LigneEvenement heure="09:24" titre="Titre" detail={<p>Le détail</p>} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Le détail')).not.toBeVisible()
  })

  it('se déplie et se replie au clavier', async () => {
    const utilisateur = userEvent.setup()
    render(<LigneEvenement heure="09:24" titre="Titre" detail={<p>Le détail</p>} />)
    await utilisateur.tab()
    expect(screen.getByRole('button')).toHaveFocus()
    await utilisateur.keyboard('{Enter}')
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Le détail')).toBeVisible()
    await utilisateur.keyboard(' ')
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Le détail')).not.toBeVisible()
  })

  it('relie le bouton au détail avec aria-controls', () => {
    render(<LigneEvenement heure="09:24" titre="Titre" detail={<p>Le détail</p>} deplieParDefaut />)
    const identifiant = screen.getByRole('button').getAttribute('aria-controls') ?? ''
    expect(document.getElementById(identifiant)).toContainElement(screen.getByText('Le détail'))
  })

  it('affiche les badges', () => {
    render(
      <LigneEvenement heure="09:24" titre="Titre" badges={<BadgeNeComptePas raison="relance" />} />,
    )
    expect(screen.getByText('Ne compte pas · Relance')).toBeInTheDocument()
  })

  it.each([false, true])("n'a aucune violation d'accessibilité (dépliée : %s)", async (deplie) => {
    const { container } = render(
      <LigneEvenement
        heure="09:24"
        titre="Titre"
        precisions={['Précision']}
        detail={<p>Le détail</p>}
        deplieParDefaut={deplie}
        badges={<BadgeNeComptePas raison="avec_support" />}
      />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
