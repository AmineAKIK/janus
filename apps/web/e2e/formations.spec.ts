import { expect, test } from '@playwright/test'
import { activerInterrupteurs, ouvrirSession } from './session.ts'

test.describe('formations et modules', () => {
  test.beforeEach(async ({ page }) => {
    await ouvrirSession(page)
  })

  test('de la liste des formations à la liste des modules', async ({ page }) => {
    await page.goto('./#/formations')
    await expect(page.getByText('2 blocs acquis sur 20')).toBeVisible()

    await page.getByRole('link', { name: /DWWM · Développeur/ }).click()

    await expect(page).toHaveURL(/#\/formations\/DWWM$/)
    await expect(page.getByRole('link', { name: /Module 1/ })).toContainText(
      '20 blocs · 7 ouverts · 2 acquis',
    )
    await expect(page.getByText('Pas encore importé')).toHaveCount(3)
  })

  test('une seconde formation s’affiche sans changer le code', async ({ page }) => {
    await page.goto('./#/formations')
    await activerInterrupteurs(page, ['deuxFormations'])

    await expect(page.getByRole('heading', { name: /CDA · Concepteur/ })).toBeVisible()
    await expect(
      page.getByText('Formation non commencée · contenu prêt à être importé'),
    ).toBeVisible()
  })
})
