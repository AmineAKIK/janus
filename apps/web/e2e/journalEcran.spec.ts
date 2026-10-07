import { expect, test } from '@playwright/test'
import { ouvrirSession } from './session.ts'

test.describe('Journal', () => {
  test('filtrer par B04 puis recharger garde le filtre', async ({ page }) => {
    await ouvrirSession(page)
    await page.goto('./#/journal')
    await expect(page.getByRole('heading', { level: 1, name: 'Journal' })).toBeVisible()

    await page.getByRole('combobox', { name: /^Bloc/ }).selectOption('B04')
    await expect(page.getByRole('button', { name: 'Retirer le filtre B04' })).toBeVisible()
    await expect(page).toHaveURL(/bloc=B04/)

    await page.reload()
    await expect(page.getByRole('button', { name: 'Retirer le filtre B04' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: /^Bloc/ })).toHaveValue('B04')
  })

  test('ajoute une note sur une ligne et la retrouve', async ({ page }) => {
    await ouvrirSession(page)
    await page.goto('./#/journal?bloc=B04&type=erreur_critique')

    await page
      .getByRole('button', { name: /B04 · Erreur critique/ })
      .first()
      .click()
    await page.getByRole('button', { name: '+ Ajouter une note' }).click()
    await page.getByLabel('Ta note').fill('Je confonds encore.')
    await page.getByRole('button', { name: 'Enregistrer' }).click()

    await expect(page.getByText('Je confonds encore.')).toBeVisible()
  })

  test('ne déborde pas à 390 px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 })
    await ouvrirSession(page)
    await page.goto('./#/journal')
    await expect(page.getByRole('button', { name: /^Filtres · 0$/ })).toBeVisible()

    const debordement = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(debordement).toBe(false)
  })
})
