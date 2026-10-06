import { expect, test } from '@playwright/test'
import { ouvrirSession } from './session.ts'

test.describe('Aujourd’hui', () => {
  test('« Commencer la séance » mène à la première tâche', async ({ page }) => {
    await ouvrirSession(page)
    await expect(page.getByText(/Prochaine étape · 1 sur/)).toBeVisible()

    await page.getByRole('button', { name: 'Commencer la séance' }).click()

    await expect(page).toHaveURL(/#\/(blocs|questions|verifications)\//)
  })

  test('un nœud de la grille ouvre le bloc', async ({ page }) => {
    await ouvrirSession(page)
    await page.getByRole('list', { name: 'Blocs du module' }).getByRole('link').nth(2).click()

    await expect(page).toHaveURL(/#\/blocs\/B03/)
  })
})
