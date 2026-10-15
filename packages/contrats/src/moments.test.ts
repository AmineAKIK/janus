import { describe, expect, it } from 'vitest'
import { TypeEtape } from './manifeste.ts'
import { MOMENTS, momentDeLEtape } from './moments.ts'

describe('momentDeLEtape', () => {
  it('range chaque type d’étape dans un des quatre moments, dans l’ordre de la méthode', () => {
    expect(MOMENTS.map(({ id }) => id)).toEqual(['decouvrir', 'comprendre', 'entrainer', 'prouver'])
    expect(TypeEtape.options.map((type) => momentDeLEtape(type).id)).toEqual([
      'decouvrir',
      'decouvrir',
      'comprendre',
      'comprendre',
      'comprendre',
      'entrainer',
      'entrainer',
      'entrainer',
      'prouver',
      'prouver',
      'prouver',
    ])
  })

  it('rend le moment lui-même, avec son libellé affichable', () => {
    expect(momentDeLEtape('ensemble')).toBe(MOMENTS[1])
    expect(momentDeLEtape('perception').libelle).toBe('Découvrir')
  })
})
