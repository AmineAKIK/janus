// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')

/** Variable Figma `groupe/nom` -> variable CSS `--groupe-nom`, avec sa valeur claire et sombre. */
const COULEURS: Record<string, readonly [string, string]> = {
  '--couleur-fond': ['#f7f4ee', '#171512'],
  '--couleur-surface': ['#fffdf9', '#211e1a'],
  '--couleur-surface-douce': ['#efe9df', '#2c2822'],
  '--couleur-ligne': ['#d6cec2', '#4a433a'],
  '--couleur-encre': ['#201d19', '#f6f1e9'],
  '--couleur-texte-secondaire': ['#655f57', '#c9c0b5'],
  '--couleur-accent': ['#164a8a', '#78a9ef'],
  '--couleur-accent-sur-fond': ['#ffffff', '#101c2c'],
  '--couleur-succes': ['#176b45', '#58c690'],
  '--couleur-alerte': ['#8a5a00', '#f2bc52'],
  '--couleur-erreur': ['#a62434', '#ff8795'],
  '--couleur-focus': ['#2b6cb0', '#8bb9f5'],
  '--effet-ombre-carte': ['#201d19', '#000000'],
  '--statut-non-commence': ['#8e887f', '#a9a198'],
  '--statut-en-cours': ['#6f7f91', '#91a7bf'],
  '--statut-vu': ['#4d8ed8', '#73adec'],
  '--statut-acquis-provisoirement': ['#b87808', '#e0a943'],
  '--statut-acquis': ['#27885b', '#58b985'],
  '--statut-maitrise': ['#15613e', '#3e9b6b'],
  '--statut-a-reprendre': ['#b12a3c', '#f07886'],
}

describe('tokens.css', () => {
  it('définit les 20 couleurs', () => {
    expect(Object.keys(COULEURS)).toHaveLength(20)
  })

  it.each(Object.entries(COULEURS))('%s a ses valeurs claire et sombre', (nom, [clair, sombre]) => {
    expect(css).toContain(`${nom}: light-dark(${clair}, ${sombre});`)
  })

  it.each([4, 8, 12, 16, 24, 32, 48])('définit --espacement-%i', (px) => {
    expect(css).toContain(`--espacement-${String(px)}: ${String(px / 16)}rem;`)
  })

  it('définit les rayons, l’ombre de carte et l’anneau de focus', () => {
    expect(css).toContain('--rayon-champ: 0.5rem;')
    expect(css).toContain('--rayon-carte: 0.75rem;')
    expect(css).toContain('--ombre-carte: 0 6px 20px')
    expect(css).toContain(
      '--focus-anneau: 0 0 0 2px var(--couleur-fond), 0 0 0 4px var(--couleur-focus);',
    )
  })

  it('définit les hauteurs et la taille des icônes, avec la bascule desktop à 1024 px', () => {
    expect(css).toContain('--hauteur-champ: 48px;')
    expect(css).toContain('--hauteur-bouton: 48px;')
    expect(css).toContain('--taille-icone: 24px;')
    expect(css).toContain('@media (min-width: 1024px)')
    expect(css).toContain('--hauteur-champ: 44px;')
    expect(css).toContain('--hauteur-bouton: 44px;')
    expect(css).toContain('--taille-icone: 20px;')
  })

  it('définit les dimensions de la navigation, des sélecteurs et des lignes de réglage', () => {
    expect(css).toContain('--largeur-navigation: 240px;')
    expect(css).toContain('--hauteur-barre-navigation: 72px;')
    expect(css).toContain('--hauteur-entree-navigation: 60px;')
    expect(css).toContain('--hauteur-entree-navigation: 48px;')
    expect(css).toContain('--hauteur-selecteur: 48px;')
    expect(css).toContain('--hauteur-ligne-reglage: 72px;')
    expect(css).toContain('--largeur-interrupteur: 44px;')
  })

  it('définit la zone tactile minimale à 44 px, indépendante de la taille du texte', () => {
    expect(css).toContain('--cible-tactile-min: 44px;')
  })

  it('définit les trois tailles de texte', () => {
    expect(css).toContain("[data-taille='petit']")
    expect(css).toContain('font-size: 87.5%;')
    expect(css).toContain('font-size: 100%;')
    expect(css).toContain('font-size: 112.5%;')
  })
})
