import { expect, test } from '@playwright/test'
import { remettreAZero } from './banc.ts'
import { ouvrirSession } from '../e2e/session.ts'
import { acquerirB01 } from './parcours.ts'

test.describe('bloc complet sur l’API réelle', () => {
  test.beforeEach(async ({ request }) => {
    await remettreAZero(request)
  })

  test('restitution, pratique et atelier : le bloc est acquis provisoirement', async ({ page }) => {
    await ouvrirSession(page)

    await acquerirB01(page)

    await page.goto('./#/blocs/B01')
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Bits et codages' })).toBeVisible()
    await expect(page.getByText('Acquis provisoirement', { exact: true })).toBeVisible()
  })
})
