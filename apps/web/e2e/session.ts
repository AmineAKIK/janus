import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/** Ouvre une session de démonstration par l'écran de connexion, comme le ferait Amine. */
export async function ouvrirSession(page: Page): Promise<void> {
  await page.goto('./#/connexion')
  await page.getByLabel('Nom d’utilisateur').fill('amine')
  await page.getByLabel('Mot de passe', { exact: true }).fill('demo-janus')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Aujourd’hui' })).toBeVisible()
}
