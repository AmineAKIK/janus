// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { COULEUR_BARRE, synchroniserCouleurBarre } from './couleurBarre.ts'

function balise(media: string | null, content: string) {
  return {
    content,
    getAttribute: (nom: string) => (nom === 'media' ? media : null),
  }
}

function installer(balises: ReturnType<typeof balise>[]) {
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { head: { querySelectorAll: () => balises } },
  })
}

describe('couleur de la barre', () => {
  it('reprend le fond de chaque thème de tokens.css', () => {
    const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')
    expect(tokens).toContain(
      `--couleur-fond: light-dark(${COULEUR_BARRE.clair}, ${COULEUR_BARRE.sombre});`,
    )
  })

  it('garde une couleur par balise avec le thème du système', () => {
    const claire = balise('(prefers-color-scheme: light)', '#000000')
    const sombre = balise('(prefers-color-scheme: dark)', '#000000')
    installer([claire, sombre])
    synchroniserCouleurBarre('systeme')
    expect(claire.content).toBe('#ffffff')
    expect(sombre.content).toBe('#14171a')
  })

  it('donne la même couleur aux deux balises avec un thème forcé', () => {
    const claire = balise('(prefers-color-scheme: light)', '#ffffff')
    const sombre = balise('(prefers-color-scheme: dark)', '#14171a')
    installer([claire, sombre])
    synchroniserCouleurBarre('sombre')
    expect([claire.content, sombre.content]).toEqual(['#14171a', '#14171a'])
    synchroniserCouleurBarre('clair')
    expect([claire.content, sombre.content]).toEqual(['#ffffff', '#ffffff'])
  })
})
