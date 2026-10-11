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
  // Étroit, le fil est replié derrière un bouton : l'ouvrir est un clic comme un autre (voir `ouvrirFil`).
  return page
    .getByRole('navigation', { name: 'Étapes de la fiche' })
    .getByRole('button', { name: new RegExp(`${nom}$`) })
}

/**
 * Attend que le serveur ait recalculé le statut après la dernière réponse d'une série : la fiche
 * affiche alors le statut attendu (« Vu » après la restitution, par exemple).
 */
export async function serieEnregistree(page: Page, statut: string): Promise<void> {
  await expect(page.frameLocator('iframe').getByText(`Statut : ${statut}`)).toBeVisible()
}

/** Ouvre une étape et attend que la fiche l'ait affichée : ce qu'on lit ensuite est celui de l'étape. */
export async function allerEtape(page: Page, nom: string): Promise<void> {
  await ouvrirFil(page)
  await etape(page, nom).click()
  await expect(etape(page, nom)).toHaveAttribute('aria-current', 'step')
}

/** Étroit, le fil des étapes est replié derrière un bouton ; large, il n'y a rien à ouvrir. */
export async function ouvrirFil(page: Page): Promise<void> {
  const bascule = page
    .getByRole('navigation', { name: 'Étapes de la fiche' })
    .getByRole('button', { expanded: false })
    .first()
  if (await bascule.isVisible()) await bascule.click()
}
