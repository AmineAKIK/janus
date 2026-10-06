import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { EditeurCode } from './EditeurCode.tsx'
import { desindenter, indenter } from './raccourcis.ts'

function Exemple({ depart = '' }: { readonly depart?: string }) {
  const [valeur, setValeur] = useState(depart)
  return (
    <>
      <EditeurCode libelle="Ton code" value={valeur} onChange={setValeur} />
      <button type="button">Après</button>
    </>
  )
}

describe('raccourcis', () => {
  it('Tab insère deux espaces au curseur', () => {
    expect(indenter({ valeur: 'ab', debut: 1, fin: 1 })).toEqual({
      valeur: 'a  b',
      debut: 3,
      fin: 3,
    })
  })

  it('Tab indente chaque ligne d’une sélection', () => {
    expect(indenter({ valeur: 'a\nb\nc', debut: 0, fin: 3 })).toEqual({
      valeur: '  a\n  b\nc',
      debut: 2,
      fin: 7,
    })
  })

  it('Maj+Tab retire au plus deux espaces par ligne', () => {
    expect(desindenter({ valeur: '    a\n b\nc', debut: 0, fin: 9 })).toEqual({
      valeur: '  a\nb\nc',
      debut: 0,
      fin: 6,
    })
  })

  it('Maj+Tab ne retire rien d’une ligne sans retrait', () => {
    expect(desindenter({ valeur: 'a', debut: 1, fin: 1 })).toEqual({
      valeur: 'a',
      debut: 1,
      fin: 1,
    })
  })
})

describe('EditeurCode', () => {
  it('numérote une ligne par saut de ligne', () => {
    const { container } = render(<Exemple depart={'a\nb\nc'} />)

    expect(container.querySelectorAll('ol li')).toHaveLength(3)
  })

  it('Tab écrit deux espaces au lieu de changer de champ', async () => {
    const utilisateur = userEvent.setup()
    render(<Exemple depart="x" />)
    const champ = screen.getByRole('textbox', { name: 'Ton code' })

    await utilisateur.click(champ)
    await utilisateur.keyboard('{Tab}')

    expect(champ).toHaveValue('x  ')
    expect(champ).toHaveFocus()
  })

  it('Échap puis Tab sort du champ', async () => {
    const utilisateur = userEvent.setup()
    render(<Exemple depart="x" />)
    const champ = screen.getByRole('textbox', { name: 'Ton code' })

    await utilisateur.click(champ)
    await utilisateur.keyboard('{Escape}{Tab}')

    expect(champ).toHaveValue('x')
    expect(screen.getByRole('button', { name: 'Après' })).toHaveFocus()
  })
})
