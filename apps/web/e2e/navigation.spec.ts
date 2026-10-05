import { expect, test } from '@playwright/test'

const VITRINE = './vitrine.html'

test.describe('navigation', () => {
  test('à 1023 px, barre basse de 72 px sans nom d’appli', async ({ page }) => {
    await page.setViewportSize({ width: 1023, height: 800 })
    await page.goto(VITRINE)
    const navigation = page.getByRole('navigation', { name: 'Navigation principale' })

    await expect(navigation).toBeVisible()
    const boite = await navigation.boundingBox()
    expect(boite?.height).toBe(72)
    await expect(navigation.getByText('Atelier')).toBeHidden()
  })

  test('à 1024 px, barre latérale de 240 px avec le nom de l’appli', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 })
    await page.goto(VITRINE)
    const navigation = page.getByRole('navigation', { name: 'Navigation principale' })

    const boite = await navigation.boundingBox()
    expect(boite?.width).toBe(240)
    await expect(navigation.getByText('Atelier')).toBeVisible()
  })

  test('les entrées font au moins 44 px de haut en mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(VITRINE)
    const liens = page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link')

    for (const lien of await liens.all()) {
      const boite = await lien.boundingBox()
      expect(boite?.height).toBeGreaterThanOrEqual(44)
      expect(boite?.width).toBeGreaterThanOrEqual(44)
    }
  })

  test('cliquer une entrée la rend active', async ({ page }) => {
    await page.goto(VITRINE)
    const navigation = page.getByRole('navigation', { name: 'Navigation principale' })

    await navigation.getByRole('link', { name: 'Journal' }).click()

    await expect(navigation.getByRole('link', { name: 'Journal' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(navigation.getByRole('link', { name: 'Aujourd’hui' })).not.toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})
