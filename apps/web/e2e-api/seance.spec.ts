import { expect, test } from '@playwright/test'
import { ouvrirSession } from '../e2e/session.ts'
import { remettreAZero } from './banc.ts'

test.describe('séance du jour sur l’API réelle', () => {
  test.beforeEach(async ({ request }) => {
    await remettreAZero(request)
  })

  test('connexion puis « Commencer » mène au premier bloc', async ({ page }) => {
    await ouvrirSession(page)

    await page.getByRole('button', { name: 'Commencer', exact: true }).click()

    await expect(page).toHaveURL(/#\/blocs\/B01/)
  })
})
