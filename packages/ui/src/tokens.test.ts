// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')

/** Variable Figma `groupe/nom` -> variable CSS `--groupe-nom`, avec sa valeur claire et sombre. */
const COULEURS: Record<string, readonly [string, string]> = {
  '--couleur-fond': ['#ffffff', '#14171a'],
  '--couleur-surface': ['#f7f8f9', '#1a1e22'],
  '--couleur-surface-elevee': ['#ffffff', '#21262b'],
  '--couleur-surface-douce': ['#eff1f3', '#272d33'],
  '--couleur-ligne': ['#e5e7ea', '#2a3036'],
  '--couleur-controle': ['#858b94', '#707a85'],
  '--couleur-encre': ['#1b1f24', '#e8eaed'],
  '--couleur-texte-secondaire': ['#5b626b', '#a3a9b0'],
  '--couleur-texte-discret': ['#666d76', '#8b929a'],
  '--couleur-accent': ['#2c5d92', '#8fb6e4'],
  '--couleur-accent-sur-fond': ['#ffffff', '#0f1a28'],
  '--couleur-accent-douce': ['#e8eff8', '#1f2b3a'],
  '--couleur-succes': ['#276f50', '#5dc196'],
  '--couleur-alerte': ['#95620a', '#e0ac4a'],
  '--couleur-erreur': ['#ae3846', '#ee8591'],
  '--couleur-focus': ['#2b6cb0', '#8bb9f5'],
  '--effet-ombre-carte': ['#1b1f24', '#000000'],
  '--statut-non-commence': ['#858b94', '#8d949c'],
  '--statut-en-cours': ['#6f7f91', '#91a7bf'],
  '--statut-vu': ['#2b66a3', '#7db3ea'],
  '--statut-acquis-provisoirement': ['#95620a', '#e0ac4a'],
  '--statut-acquis': ['#276f50', '#5dc196'],
  '--statut-maitrise': ['#15613e', '#3e9b6b'],
  '--statut-a-reprendre': ['#ae3846', '#ee8591'],
}

describe('tokens.css', () => {
  it('définit les 24 couleurs', () => {
    expect(Object.keys(COULEURS)).toHaveLength(24)
  })

  it.each(Object.entries(COULEURS))('%s a ses valeurs claire et sombre', (nom, [clair, sombre]) => {
    expect(css).toContain(`${nom}: light-dark(${clair}, ${sombre});`)
  })

  it.each([4, 8, 12, 16, 24, 32, 48])('définit --espacement-%i', (px) => {
    expect(css).toContain(`--espacement-${String(px)}: ${String(px / 16)}rem;`)
  })

  it('définit les rayons, l’ombre de carte et l’anneau de focus', () => {
    expect(css).toContain('--rayon-champ: 0.625rem;')
    expect(css).toContain('--rayon-carte: 0.875rem;')
    expect(css).toContain('--rayon-hero: 1rem;')
    expect(css).toContain('--ombre-carte:')
    expect(css).toContain('--duree-transition: 160ms;')
    expect(css).toContain('--largeur-lecture: 62ch;')
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
