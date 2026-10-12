import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { axe } from '../../tests/axe.ts'
import { Selecteur } from './Selecteur.tsx'

/** La liste s'ouvre hors du conteneur de test : la règle des « régions » de la page n'a pas de sens ici. */
const SANS_REGION = { rules: { region: { enabled: false } } }

const OPTIONS = [
  { valeur: 'paris', libelle: 'Europe/Paris' },
  { valeur: 'londres', libelle: 'Europe/London' },
  { valeur: 'lisbonne', libelle: 'Europe/Lisbon' },
]

function afficher(auChangement = vi.fn()) {
  render(
    <Selecteur libelle="Fuseau horaire" options={OPTIONS} valeur="paris" onChange={auChangement} />,
  )
  return { auChangement, bouton: screen.getByRole('combobox', { name: 'Fuseau horaire' }) }
}

describe('Selecteur', () => {
  it('montre le choix courant et garde la liste fermée', () => {
    const { bouton } = afficher()

    expect(bouton).toHaveTextContent('Europe/Paris')
    expect(bouton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('ouvre la liste au clic, marque le choix courant et choisit une autre ligne', async () => {
    const utilisateur = userEvent.setup()
    const { auChangement, bouton } = afficher()

    await utilisateur.click(bouton)
    const liste = screen.getByRole('listbox', { name: 'Fuseau horaire' })

    expect(within(liste).getByRole('option', { name: 'Europe/Paris' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await utilisateur.click(within(liste).getByRole('option', { name: 'Europe/London' }))

    expect(auChangement).toHaveBeenCalledWith('londres')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('se pilote au clavier : flèches, Entrée, Échap', async () => {
    const utilisateur = userEvent.setup()
    const { auChangement, bouton } = afficher()

    bouton.focus()
    await utilisateur.keyboard('{ArrowDown}')
    expect(bouton).toHaveAttribute('aria-expanded', 'true')
    await utilisateur.keyboard('{ArrowDown}{Enter}')
    expect(auChangement).toHaveBeenCalledWith('londres')

    await utilisateur.keyboard('{ArrowDown}{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(auChangement).toHaveBeenCalledTimes(1)
  })

  it('trouve une ligne en tapant ses premières lettres', async () => {
    const utilisateur = userEvent.setup()
    const { auChangement, bouton } = afficher()

    bouton.focus()
    await utilisateur.keyboard('{ArrowDown}europe/lis{Enter}')

    expect(auChangement).toHaveBeenCalledWith('lisbonne')
  })

  it('un clic ailleurs ferme la liste sans rien changer', async () => {
    const utilisateur = userEvent.setup()
    const { auChangement, bouton } = afficher()

    await utilisateur.click(bouton)
    await utilisateur.click(document.body)

    expect(screen.queryByRole('listbox')).toBeNull()
    expect(auChangement).not.toHaveBeenCalled()
  })

  it('désactivé, il ne s’ouvre pas', async () => {
    render(
      <Selecteur libelle="Fuseau" options={OPTIONS} valeur="paris" onChange={vi.fn()} disabled />,
    )

    await userEvent.setup().click(screen.getByRole('combobox'))

    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('n’a aucune violation d’accessibilité, fermé comme ouvert', async () => {
    const { bouton } = afficher()
    expect(await axe(document.body, SANS_REGION)).toHaveNoViolations()

    await userEvent.setup().click(bouton)

    expect(await axe(document.body, SANS_REGION)).toHaveNoViolations()
  })
})
