import { expect, test } from '@playwright/test'
import { ouvrirSession } from './session.ts'

test.describe('Suivi', () => {
  test('la carte mène aux blocs et la période change l’adresse', async ({ page }) => {
    await ouvrirSession(page)
    await page.goto('./#/tableau-de-bord')
    await expect(page.getByRole('heading', { level: 1, name: 'Suivi' })).toBeVisible()

    await page.getByRole('radio', { name: '7 jours' }).check()
    await expect(page).toHaveURL(/periode=7j/)

    await page.getByRole('link', { name: /B03/ }).first().click()
    await expect(page).toHaveURL(/#\/blocs\/B03/)
  })

  test('force un statut puis revient au statut calculé', async ({ page }) => {
    await ouvrirSession(page)
    await page.goto('./#/tableau-de-bord')

    await page.getByRole('button', { name: 'Forcer un statut' }).click()
    await page.getByLabel('Raison').fill('Je connais déjà ce sujet.')
    await page.getByRole('button', { name: 'Forcer le statut' }).click()

    await expect(page.getByText(/Raison : Je connais déjà/)).toBeVisible()
    await page.getByRole('button', { name: /Revenir au statut calculé/ }).click()
    await expect(page.getByRole('button', { name: /Revenir au statut calculé/ })).toHaveCount(0)
  })
})
