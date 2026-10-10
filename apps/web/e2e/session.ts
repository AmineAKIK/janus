import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

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

/** Le bouton d'une étape dans le fil de la page (la fiche intégrée n'a plus de fil à elle). */
export function etape(page: Page, nom: string): Locator {
  return page
    .getByRole('navigation', { name: 'Étapes de la fiche' })
    .getByRole('button', { name: new RegExp(`${nom}$`) })
}

/** Attend que l'appli ait reçu toute la série : tant qu'il en manque, les étapes de cours sont verrouillées. */
export async function serieEnregistree(page: Page): Promise<void> {
  await expect(
    page.getByRole('navigation', { name: 'Étapes de la fiche' }).locator('button[title]'),
  ).toHaveCount(0)
}
