import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { axe } from '../../tests/axe.ts'
import {
  Navigation,
  NOM_APPLI,
  type CleNavigation,
  type ProprietesLienNavigation,
} from './Navigation.tsx'

const CHEMINS: Record<CleNavigation, string> = {
  aujourdhui: '/',
  formations: '/formations',
  tableau: '/suivi',
  journal: '/journal',
  parametres: '/parametres',
}

function lien({ cle, children, ...reste }: ProprietesLienNavigation) {
  return (
    <a href={CHEMINS[cle]} {...reste}>
      {children}
    </a>
  )
}

describe('Navigation', () => {
  it('est une navigation nommée avec les 5 entrées dans l’ordre', () => {
    render(<Navigation actif="aujourdhui" lien={lien} />)
    const navigation = screen.getByRole('navigation', { name: 'Navigation principale' })
    const liens = within(navigation).getAllByRole('link')
    expect(liens.map((element) => element.textContent)).toEqual([
      'Aujourd’hui',
      'Formations',
      'Suivi',
      'Journal',
      'Paramètres',
    ])
  })

  it('affiche le nom de l’appli', () => {
    render(<Navigation actif="aujourdhui" lien={lien} />)
    expect(NOM_APPLI).toBe('Atelier')
    expect(screen.getByText('Atelier')).toBeInTheDocument()
  })

  it.each([
    ['aujourdhui', 'Aujourd’hui'],
    ['formations', 'Formations'],
    ['tableau', 'Suivi'],
    ['journal', 'Journal'],
    ['parametres', 'Paramètres'],
  ] as const)('l’entrée active %s porte aria-current="page", elle seule', (actif, nom) => {
    render(<Navigation actif={actif} lien={lien} />)
    const courants = screen
      .getAllByRole('link')
      .filter((element) => element.getAttribute('aria-current') === 'page')
    expect(courants).toHaveLength(1)
    expect(courants[0]).toHaveAccessibleName(nom)
  })

  it('rend les liens avec la fonction fournie, sans routeur', () => {
    render(<Navigation actif="journal" lien={lien} />)
    expect(screen.getByRole('link', { name: 'Journal' })).toHaveAttribute('href', '/journal')
  })

  it('se parcourt au clavier, une entrée après l’autre', async () => {
    const utilisateur = userEvent.setup()
    render(<Navigation actif="aujourdhui" lien={lien} />)

    await utilisateur.tab()
    expect(screen.getByRole('link', { name: 'Aujourd’hui' })).toHaveFocus()
    await utilisateur.tab()
    expect(screen.getByRole('link', { name: 'Formations' })).toHaveFocus()
  })

  it('n’a aucune violation d’accessibilité', async () => {
    const { container } = render(<Navigation actif="formations" lien={lien} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
