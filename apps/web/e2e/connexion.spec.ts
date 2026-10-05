import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function saisir(page: Page, nom: string, mot: string) {
  await page.getByLabel('Nom d’utilisateur').fill(nom)
  await page.getByLabel('Mot de passe', { exact: true }).fill(mot)
}

const bouton = (page: Page) => page.getByRole('button', { name: /Se connecter|Réessayer/ })
const capture = async (page: Page, etat: string) =>
  page.screenshot({ path: `captures/connexion-etat-${etat}.png`, fullPage: true })

test.describe('connexion', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
  })

  test('Vide puis Rempli : le bouton ouvre la session et mène à Aujourd’hui', async ({ page }) => {
    await page.goto('./#/connexion')
    await expect(page.getByRole('heading', { level: 1, name: 'Atelier' })).toBeVisible()
    await capture(page, 'vide')

    await saisir(page, 'amine', 'demo-janus')
    await capture(page, 'rempli')
    await bouton(page).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Aujourd’hui' })).toBeVisible()
  })

  test('Erreur : un mauvais couple affiche un seul message et vide le mot de passe', async ({
    page,
  }) => {
    await page.goto('./#/connexion')
    await saisir(page, 'amine', 'faux')
    await bouton(page).click()

    await expect(page.getByText('Nom d’utilisateur ou mot de passe incorrect.')).toBeVisible()
    await expect(page.getByLabel('Mot de passe', { exact: true })).toHaveValue('')
    await capture(page, 'erreur')
  })

  test('Trop d’essais : le bouton est bloqué avec un compte à rebours', async ({ page }) => {
    await page.goto('./#/connexion')
    for (let i = 0; i < 5; i += 1) {
      await saisir(page, 'amine', 'faux')
      await bouton(page).click()
      await expect(page.getByRole('alert')).toBeVisible()
    }

    await expect(page.getByText(/Trop d’essais\. Réessaie dans/)).toBeVisible()
    await expect(bouton(page)).toBeDisabled()
    await expect(bouton(page)).toHaveText(/Réessayer dans \d:\d\d/)
    await capture(page, 'trop-d-essais')
  })

  test('Hors connexion : bandeau, saisie gardée, retour du réseau', async ({ page, context }) => {
    await page.goto('./#/connexion')
    await saisir(page, 'amine', 'demo-janus')
    await context.setOffline(true)

    await expect(page.getByText(/Pas de connexion internet/)).toBeVisible()
    await expect(page.getByLabel('Nom d’utilisateur')).toHaveValue('amine')
    await capture(page, 'hors-connexion')

    await context.setOffline(false)
    await expect(page.getByText(/Pas de connexion internet/)).toHaveCount(0)
  })

  test('Clavier ouvert : le champ actif reste visible', async ({ page }) => {
    await page.goto('./#/connexion')
    await page.getByLabel('Mot de passe', { exact: true }).focus()

    await expect(page.getByLabel('Mot de passe', { exact: true })).toBeInViewport()
    await capture(page, 'clavier-ouvert')
  })

  test('sans session, une page de l’appli mène ici puis y revient après la connexion', async ({
    page,
  }) => {
    await page.goto('./#/journal')

    await expect(page.getByRole('heading', { level: 1, name: 'Atelier' })).toBeVisible()
    await saisir(page, 'amine', 'demo-janus')
    await bouton(page).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Journal' })).toBeVisible()
  })
})
