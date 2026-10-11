import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MarqueJanus } from './MarqueJanus.tsx'

describe('MarqueJanus', () => {
  it('est décorative et suit la couleur du texte', () => {
    const { container } = render(<MarqueJanus taille={80} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    expect(svg?.getAttribute('width')).toBe('80')
    expect(container.querySelector('path')?.getAttribute('stroke')).toBe('currentColor')
  })
})
