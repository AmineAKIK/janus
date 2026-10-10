// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./typographie.css', import.meta.url), 'utf8')

describe('liens', () => {
  it('ont la couleur d’accent par défaut, sans règle propre aux liens visités', () => {
    expect(css).toMatch(/\ba\s*\{[^}]*color:\s*var\(--couleur-accent\)/)
    expect(css).not.toContain(':visited')
  })
})
