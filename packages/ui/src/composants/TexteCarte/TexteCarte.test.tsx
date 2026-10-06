import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { analyser } from './analyse.ts'
import { TexteCarte } from './TexteCarte.tsx'

describe('TexteCarte', () => {
  it('rend paragraphes, gras et code en ligne', () => {
    const { container } = render(
      <TexteCarte texte={'Un **mot** et du `code`.\n\nSecond paragraphe.'} />,
    )

    expect(container.querySelectorAll('p')).toHaveLength(2)
    expect(container.querySelector('strong')).toHaveTextContent('mot')
    expect(container.querySelector('p code')).toHaveTextContent('code')
  })

  it('rend une liste numérotée', () => {
    render(<TexteCarte texte={'1. Premier\n2. Deuxième\n3) Troisième'} />)

    const elements = screen.getAllByRole('listitem')
    expect(elements.map((element) => element.textContent)).toEqual([
      'Premier',
      'Deuxième',
      'Troisième',
    ])
  })

  it('rend un bloc de code tel quel, sans interpréter son contenu', () => {
    const { container } = render(
      <TexteCarte texte={'Avant\n```\nlet a = **1**\nconst b\n```\nAprès'} />,
    )

    expect(container.querySelector('pre code')?.textContent).toBe('let a = **1**\nconst b')
    expect(container.querySelector('pre strong')).toBeNull()
  })

  it('ne prend jamais le HTML pour du HTML', () => {
    const { container } = render(
      <TexteCarte texte={'<b>gras ?</b> <script>alert(1)</script> <img src=x onerror=alert(1)>'} />,
    )

    expect(container.querySelector('b, script, img')).toBeNull()
    expect(container).toHaveTextContent('<b>gras ?</b>')
    expect(container).toHaveTextContent('<script>alert(1)</script>')
  })

  it('garde les retours à la ligne d’un paragraphe', () => {
    expect(analyser('a\nb')).toEqual([
      { type: 'paragraphe', segments: [{ type: 'texte', texte: 'a\nb' }] },
    ])
  })

  it('referme un bloc de code resté ouvert à la fin du texte', () => {
    expect(analyser('```\nx')).toEqual([{ type: 'bloc_de_code', code: 'x' }])
  })
})
