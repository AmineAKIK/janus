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

/** Active des interrupteurs de démo (états Figma qui dépendent du serveur) puis recharge l'appli. */
export async function activerInterrupteurs(page: Page, noms: readonly string[]): Promise<void> {
  await page.evaluate((interrupteurs) => {
    const cle = 'janus.demo.v1'
    const etat = JSON.parse(localStorage.getItem(cle) ?? 'null') as {
      interrupteurs: Record<string, boolean>
    }
    for (const nom of interrupteurs) etat.interrupteurs[nom] = true
    localStorage.setItem(cle, JSON.stringify(etat))
  }, noms)
  await page.reload()
}
