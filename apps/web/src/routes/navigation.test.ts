import { describe, expect, it } from 'vitest'
import { adresse } from './navigation.ts'

describe('adresse', () => {
  it('garde une ancre dans le mode par défaut', () => {
    expect(adresse('/parametres/regles')).toBe('#/parametres/regles')
  })
})
