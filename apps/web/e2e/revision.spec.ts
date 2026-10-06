import { expect, test } from '@playwright/test'
import { ouvrirSession } from './session.ts'

test.describe('révision des cartes', () => {
  test('la file se note au clavier puis mène à l’étape suivante', async ({ page }) => {
    await ouvrirSession(page)
    await page.goto('./#/revision')
    const rang = await page.getByText(/^1 sur \d+ · dont \d+ nouvelle/).textContent()
    const total = Number(/ sur (\d+)/.exec(rang ?? '')?.[1])
    expect(total).toBeGreaterThan(0)

    for (let carte = 1; carte <= total; carte += 1) {
      await expect(
        page.getByText(new RegExp(`^${String(carte)} sur ${String(total)}`)),
      ).toBeVisible()
      await page.keyboard.press('Space')
      await expect(page.getByRole('button', { name: /^Bien/ })).toBeVisible()
      await page.keyboard.press('3')
    }

    await expect(
      page.getByRole('heading', { name: new RegExp(`^${String(total)} cartes? revues?$`) }),
    ).toBeVisible()
    await page.getByRole('button', { name: /^Étape suivante/ }).click()
    await expect(page).not.toHaveURL(/revision/)
  })

  test('annuler une note ramène la carte au recto', async ({ page }) => {
    await ouvrirSession(page)
    await page.goto('./#/revision')
    await expect(page.getByRole('button', { name: 'Voir la réponse' })).toBeVisible()
    await page.keyboard.press('Space')
    await expect(page.getByRole('button', { name: /^Difficile/ })).toBeVisible()
    await page.keyboard.press('2')
    await expect(page.getByText(/^Notée Difficile · revient dans/)).toBeVisible()

    await page.getByRole('button', { name: 'Annuler' }).click()

    await expect(page.getByRole('button', { name: 'Voir la réponse' })).toBeVisible()
    await expect(page.getByText(/^1 sur \d+/)).toBeVisible()
  })

  test('une carte « À revoir » propose de la revoir maintenant', async ({ page }) => {
    await ouvrirSession(page)
    await page.goto('./#/revision')
    const rang = await page.getByText(/^1 sur \d+ · dont \d+ nouvelle/).textContent()
    const total = Number(/ sur (\d+)/.exec(rang ?? '')?.[1])
    for (let carte = 1; carte <= total; carte += 1) {
      await page.keyboard.press('Space')
      await expect(page.getByRole('button', { name: /^Bien/ })).toBeVisible()
      await page.keyboard.press(carte === 1 ? '1' : '3')
    }

    await expect(page.getByRole('heading', { name: 'Cartes à revoir' })).toBeVisible()
    await page.getByRole('button', { name: 'Les revoir maintenant' }).click()
    await expect(page.getByRole('button', { name: 'Voir la réponse' })).toBeVisible()
  })

  test('Échap ouvre la boîte « Quitter la séance ? »', async ({ page }) => {
    await ouvrirSession(page)
    await page.goto('./#/revision')

    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog', { name: 'Quitter la séance ?' })).toBeVisible()
  })
})
