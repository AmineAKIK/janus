// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./typographie.css', import.meta.url), 'utf8')

describe('liens', () => {
  it('sont sobres : encre, sans soulignement, sans règle propre aux liens visités', () => {
    expect(css).toMatch(/\ba\s*\{[^}]*color:\s*var\(--couleur-encre\)/)
    expect(css).toMatch(/\ba\s*\{[^}]*text-decoration:\s*none/)
    expect(css).not.toContain(':visited')
  })
})
