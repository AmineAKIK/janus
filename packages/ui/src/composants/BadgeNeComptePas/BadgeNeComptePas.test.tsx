import { render, screen } from '@testing-library/react'
import { axe } from '../../tests/axe.ts'
import { describe, expect, it } from 'vitest'
import { BadgeNeComptePas } from './BadgeNeComptePas.tsx'

describe('BadgeNeComptePas', () => {
  it.each([
    ['relance', 'Ne compte pas · Relance'],
    ['avec_support', 'Ne compte pas · Avec support'],
    ['recopiee', 'Ne compte pas · Recopiée'],
    ['non_verifiee', 'Ne compte pas · Non vérifiée'],
  ] as const)('affiche %s', (raison, texte) => {
    render(<BadgeNeComptePas raison={raison} />)
    expect(screen.getByText(texte)).toBeInTheDocument()
  })

  it("n'a aucune violation d'accessibilité", async () => {
    const { container } = render(<BadgeNeComptePas raison="relance" />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
