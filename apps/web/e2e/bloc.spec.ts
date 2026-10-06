import { expect, test } from '@playwright/test'
import { ouvrirSession } from './session.ts'

test.describe('page d’un bloc', () => {
  test.beforeEach(async ({ page }) => {
    await ouvrirSession(page)
  })

  test('la fiche de démo passe en mode appli', async ({ page }) => {
    await page.goto('./#/blocs/B03')

    const fiche = page.frameLocator('iframe[title^="Fiche du bloc B03"]')
    await expect(fiche.getByRole('status').filter({ hasText: 'Dans l’appli' })).toBeVisible()
    await expect(page.getByText('Chargement de la fiche…')).toHaveCount(0)
  })

  test('un message qui ne vient pas de la fiche est ignoré', async ({ page }) => {
    const avertissements: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'warning') avertissements.push(message.text())
    })
    await page.goto('./#/blocs/B03')
    await expect(
      page.frameLocator('iframe').getByRole('status').filter({ hasText: 'Dans l’appli' }),
    ).toBeVisible()

    await page.evaluate(() => {
      window.postMessage({ type: 'page.prete', schema: 2 }, '*')
    })

    await expect.poll(() => avertissements.join('\n')).toContain('source_inconnue')
  })

  test('recharger la page remet la fiche dans l’état sauvegardé', async ({ page }) => {
    await page.goto('./#/blocs/B03')
    const fiche = page.frameLocator('iframe[title^="Fiche du bloc B03"]')
    await expect(fiche.getByRole('status').filter({ hasText: 'Dans l’appli' })).toBeVisible()

    await fiche.getByRole('button', { name: 'Pratique guidée' }).click()
    await expect(fiche.getByRole('button', { name: 'Pratique guidée' })).toHaveAttribute(
      'aria-current',
      'step',
    )
    // La fiche groupe ses sauvegardes.
    await page.waitForTimeout(2500)
    await page.reload()

    const apres = page.frameLocator('iframe[title^="Fiche du bloc B03"]')
    await expect(apres.getByRole('button', { name: 'Pratique guidée' })).toHaveAttribute(
      'aria-current',
      'step',
    )
  })

  test('le retour ramène à la liste des blocs, bloc choisi', async ({ page }) => {
    await page.goto('./#/blocs/B03')

    await page.getByRole('link', { name: 'Retour aux blocs' }).click()

    await expect(page).toHaveURL(/#\/modules\/M1\?detail=B03$/)
  })
})
