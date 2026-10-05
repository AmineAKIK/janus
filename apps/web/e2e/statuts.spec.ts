import { expect, test } from '@playwright/test'

const VITRINE = './vitrine.html'
const LIBELLES = [
  'Non commencé',
  'En cours',
  'Vu',
  'Acquis provisoirement',
  'Acquis',
  'Maîtrisé',
  'À reprendre',
]

test.describe('statuts et correction', () => {
  for (const theme of ['Clair', 'Sombre']) {
    test(`les 7 statuts et les 4 niveaux sont visibles en thème ${theme}`, async ({ page }) => {
      await page.goto(VITRINE)
      await page.getByLabel(theme).check()
      const statuts = page.getByRole('region', { name: 'Statuts' })
      for (const libelle of LIBELLES) {
        await expect(statuts.getByText(libelle, { exact: true }).first()).toBeVisible()
      }
      const correction = page.getByRole('region', { name: 'Correction' })
      for (const niveau of ['Solide', 'Partiel', 'Fragile', 'Pas encore']) {
        await expect(correction.getByText(niveau, { exact: true }).first()).toBeVisible()
      }
    })
  }

  test('un message avec <b> reste du texte', async ({ page }) => {
    await page.goto(VITRINE)
    const correction = page.getByRole('region', { name: 'Correction' })
    await expect(correction.getByText('Utilise <b>gras</b>')).toBeVisible()
    await expect(correction.locator('b')).toHaveCount(0)
  })

  test('le choix de confiance se fait au clavier', async ({ page }) => {
    await page.goto(VITRINE)
    const groupe = page.getByRole('region', { name: 'Confiance' }).getByRole('radiogroup').last()
    await groupe.getByRole('radio').first().focus()
    await page.keyboard.press('ArrowRight')
    await expect(groupe.getByRole('radio', { name: 'Hésitant' })).toBeChecked()
    await page.keyboard.press('ArrowRight')
    await expect(groupe.getByRole('radio', { name: 'Au hasard' })).toBeChecked()
  })

  test("l'infobulle s'ouvre au focus et se ferme avec Échap", async ({ page }) => {
    await page.goto(VITRINE)
    const badge = page.getByRole('region', { name: 'Statuts' }).locator('[aria-describedby]').last()
    const infobulle = page.locator(`[id="${(await badge.getAttribute('aria-describedby')) ?? ''}"]`)
    await expect(infobulle).toBeHidden()
    await badge.focus()
    await expect(infobulle).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(infobulle).toBeHidden()
  })
})
