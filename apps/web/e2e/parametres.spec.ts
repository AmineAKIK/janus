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

  test('le panneau de démo avance l’heure de 3 jours', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await ouvrirSession(page)
    await page.goto('./#/parametres/demo')
    const heure = page.getByText(/^Heure de démo/)
    const avant = await heure.textContent()

    await page.getByRole('button', { name: 'Avancer de 3 jours' }).click()

    await expect(heure).not.toHaveText(avant ?? '')
  })

  test('supprimer le compte demande le mot de passe puis ramène à la connexion', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await ouvrirSession(page)
    await page.goto('./#/parametres/zone')

    await page.getByRole('button', { name: 'Supprimer mon compte' }).click()
    const dialogue = page.getByRole('dialog', { name: 'Supprimer mon compte ?' })
    await dialogue.getByLabel('Mot de passe', { exact: true }).fill('demo-janus')
    await dialogue.getByRole('button', { name: 'Supprimer définitivement' }).click()

    await expect(page).toHaveURL(/#\/connexion$/)
  })
})
