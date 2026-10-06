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

test.describe('blocs d’un module', () => {
  test.beforeEach(async ({ page }) => {
    await ouvrirSession(page)
  })

  test('les blocs sont groupés par partie et chaque carte annonce son échéance', async ({
    page,
  }) => {
    await page.goto('./#/modules/M1')

    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(5)
    await expect(page.getByRole('link', { name: /B02/ }).first()).toContainText(
      'vérification aujourd’hui',
    )
    await expect(page.getByText('Confond compilateur et interpréteur.')).toBeVisible()
  })

  test('le filtre et le bloc choisi restent dans l’adresse, aussi après rechargement', async ({
    page,
  }) => {
    await page.goto('./#/modules/M1')
    await page.getByRole('radio', { name: 'À reprendre' }).check({ force: true })
    await expect(page.getByRole('status')).toHaveText('1 bloc')
    await expect(page).toHaveURL(/statut=a_reprendre/)

    await page.reload()

    await expect(page.getByRole('radio', { name: 'À reprendre' })).toBeChecked()
    await expect(page.getByRole('status')).toHaveText('1 bloc')
  })
})
