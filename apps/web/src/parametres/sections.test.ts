import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

async function sectionsAvec(transport: string) {
  vi.stubEnv('VITE_TRANSPORT', transport)
  vi.resetModules()
  const { SECTIONS } = await import('./sections.ts')
  return SECTIONS.map(({ cle }) => cle)
}

describe('sections de Paramètres', () => {
  it('la section Démo existe dans le build de démonstration', async () => {
    expect(await sectionsAvec('demo')).toContain('demo')
  })

  it('la section Démo n’existe pas dans le build http', async () => {
    expect(await sectionsAvec('http')).not.toContain('demo')
  })
})
