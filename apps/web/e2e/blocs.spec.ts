import { expect, test } from '@playwright/test'

const VITRINE = './vitrine.html'

test.describe('blocs et séance', () => {
  test('les 7 statuts sont sur les cartes et les nœuds de bloc', async ({ page }) => {
    await page.goto(VITRINE)
    for (const nom of ['Cartes de bloc', 'Nœuds de bloc']) {
      const section = page.getByRole('region', { name: nom })
      for (const libelle of [
        'Non commencé',
        'En cours',
        'Vu',
        'Acquis provisoirement',
        'Acquis',
        'Maîtrisé',
        'À reprendre',
      ]) {
        await expect(section.getByText(libelle, { exact: true }).first()).toBeAttached()
      }
    }
  })

  test('un nœud de bloc fait 48 × 44 px', async ({ page }) => {
    await page.goto(VITRINE)
    const noeud = page.getByRole('region', { name: 'Nœuds de bloc' }).getByRole('link').first()
    const boite = await noeud.boundingBox()
    expect(boite?.width).toBe(48)
    expect(boite?.height).toBe(44)
  })

  for (const largeur of [390, 1440]) {
    test(`un titre de 80 caractères ne casse pas la carte à ${String(largeur)} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: largeur, height: 900 })
      await page.goto(VITRINE)
      const carte = page
        .getByRole('region', { name: 'Cartes de bloc' })
        .getByRole('link', { name: /portée lexicale/ })
      await carte.scrollIntoViewIfNeeded()
      const titre = carte.getByText(/portée lexicale/)
      const boiteCarte = await carte.boundingBox()
      const boiteTitre = await titre.boundingBox()
      expect(boiteCarte).not.toBeNull()
      expect(boiteTitre).not.toBeNull()
      if (boiteCarte === null || boiteTitre === null) return
      // Deux lignes de 26 px au moins, et le titre reste dans la carte.
      expect(boiteTitre.height).toBeGreaterThan(30)
      expect(boiteTitre.x + boiteTitre.width).toBeLessThanOrEqual(boiteCarte.x + boiteCarte.width)
      const debordement = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )
      expect(debordement).toBe(false)
    })
  }
})
