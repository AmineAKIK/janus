import { expect, test } from '@playwright/test'
import { ouvrirSession } from './session.ts'

test.describe('questions de début de séance', () => {
  test('la série complète mène au bilan puis à l’étape suivante', async ({ page }) => {
    await ouvrirSession(page)
    await page.goto('./#/questions')
    const total = Number(
      (await page.getByText(/^1 sur \d+$/).textContent())?.replace('1 sur ', '') ?? '0',
    )
    expect(total).toBeGreaterThan(0)

    for (let rang = 1; rang <= total; rang += 1) {
      await expect(page.getByText(`${String(rang)} sur ${String(total)}`)).toBeVisible()
      await page.getByRole('button', { name: 'Je ne sais pas' }).click()
      await expect(page.getByText('Tu as choisi « Je ne sais pas ».')).toBeVisible()
      await page
        .getByRole('button', { name: rang === total ? 'Voir le bilan' : 'Question suivante' })
        .click()
    }

    await expect(
      page.getByRole('heading', { name: `${String(total)} questions faites` }),
    ).toBeVisible()
    await page.getByRole('button', { name: /^Étape suivante/ }).click()
    await expect(page).not.toHaveURL(/questions/)
  })

  test('quitter puis revenir reprend à la question suivante', async ({ page }) => {
    await ouvrirSession(page)
    await page.goto('./#/questions')
    await page.getByRole('button', { name: 'Je ne sais pas' }).click()
    await page.getByRole('button', { name: 'Question suivante' }).click()
    await page.getByRole('button', { name: /Quitter/ }).click()
    await expect(page.getByRole('dialog', { name: 'Quitter la séance ?' })).toBeVisible()
    await page.getByRole('button', { name: 'Reprendre plus tard' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Aujourd’hui' })).toBeVisible()

    await page.goto('./#/questions')

    await expect(page.getByText(/^2 sur \d+$/)).toBeVisible()
  })
})
