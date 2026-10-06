import { expect, test } from '@playwright/test'
import { ouvrirSession } from './session.ts'

test.describe('paramètres', () => {
  test('sur bureau, une page avec sommaire où un réglage s’enregistre à la sortie du champ', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await ouvrirSession(page)
    await page.goto('./#/parametres')
    await expect(page.getByRole('navigation', { name: 'Sur cette page' })).toBeVisible()

    const champ = page.getByLabel('Questions de début de séance')
    await champ.fill('8')
    await champ.blur()
    await expect(page.getByRole('button', { name: 'Revenir à la valeur par défaut' })).toBeVisible()

    await page.reload()
    await expect(page.getByLabel('Questions de début de séance')).toHaveValue('8')
  })

  test('sur mobile, une liste de sections puis une route par section', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 })
    await ouvrirSession(page)
    await page.goto('./#/parametres')

    await page.getByRole('link', { name: 'Règles de la méthode' }).click()

    await expect(page).toHaveURL(/#\/parametres\/regles$/)
    await expect(page.getByText('Règle protégée')).toBeVisible()
    await page.getByRole('link', { name: '← Paramètres' }).click()
    await expect(page.getByRole('navigation', { name: 'Choisis une section' })).toBeVisible()
  })
})
