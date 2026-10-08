import { expect, test } from '@playwright/test'
import { remettreAZero } from './banc.ts'
import { acquerirB01, connecter } from './parcours.ts'

test.describe('bloc complet sur l’API réelle', () => {
  test.beforeEach(async ({ request }) => {
    await remettreAZero(request)
  })

  test('restitution, consolidation une heure plus tard, pratique et atelier : le bloc est acquis provisoirement', async ({
    page,
    request,
  }) => {
    await connecter(page)

    await acquerirB01(page, request)

    await page.goto('./#/blocs/B01')
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Bits et codages' })).toBeVisible()
    await expect(page.getByText('Acquis provisoirement', { exact: true })).toBeVisible()
  })
})
