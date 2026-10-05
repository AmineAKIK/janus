import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from '../../tests/axe.ts'
import { Bouton } from '../Bouton/Bouton.tsx'
import { ChampTexte } from '../ChampTexte/ChampTexte.tsx'
import { Interrupteur } from '../Interrupteur/Interrupteur.tsx'
import { LigneReglage } from './LigneReglage.tsx'

describe('LigneReglage', () => {
  it('affiche le libellé et l’aide', () => {
    render(
      <LigneReglage
        libelle="Libellé du réglage"
        aide="Texte d’aide"
        controle={<Interrupteur coche={false} onChange={vi.fn()} />}
      />,
    )
    expect(screen.getByText('Libellé du réglage')).toBeInTheDocument()
    expect(screen.getByText('Texte d’aide')).toBeInTheDocument()
  })

  it('l’aide est facultative', () => {
    render(
      <LigneReglage
        libelle="Libellé du réglage"
        controle={<Interrupteur coche={false} onChange={vi.fn()} />}
      />,
    )
    expect(
      screen.getByRole('switch', { name: 'Libellé du réglage' }),
    ).not.toHaveAccessibleDescription()
  })

  it('accueille un champ ou un bouton comme contrôle', () => {
    render(
      <>
        <LigneReglage
          libelle="Fuseau"
          controle={<ChampTexte libelle="Valeur du fuseau" defaultValue="Europe/Paris" />}
        />
        <LigneReglage libelle="Exporter" controle={<Bouton variante="secondaire">Action</Bouton>} />
      </>,
    )
    expect(screen.getByRole('textbox', { name: 'Valeur du fuseau' })).toHaveValue('Europe/Paris')
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
  })

  it('n’a aucune violation d’accessibilité avec un champ et un bouton', async () => {
    const { container } = render(
      <>
        <LigneReglage
          libelle="Fuseau"
          aide="Utilisé pour le changement de jour"
          controle={<ChampTexte libelle="Valeur du fuseau" defaultValue="Europe/Paris" />}
        />
        <LigneReglage libelle="Exporter" controle={<Bouton variante="secondaire">Action</Bouton>} />
      </>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
