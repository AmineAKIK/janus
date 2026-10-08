import { expect, test } from '@playwright/test'
import { remettreAZero } from './banc.ts'

test.describe('séance du jour sur l’API réelle', () => {
  test.beforeEach(async ({ request }) => {
    await remettreAZero(request)
  })

  test('connexion puis « Commencer » mène au premier bloc', async ({ page }) => {
    await page.goto('./#/connexion')
    await page.getByLabel('Nom d’utilisateur').fill('amine')
    await page.getByLabel('Mot de passe', { exact: true }).fill('demo-janus')
    await page.getByRole('button', { name: 'Se connecter' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Aujourd’hui' })).toBeVisible()

    await page.getByRole('button', { name: 'Commencer', exact: true }).click()

    await expect(page).toHaveURL(/#\/blocs\/B01/)
  })
})
