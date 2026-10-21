import { expect, test } from '@playwright/test'
import { remettreAZero } from './banc.ts'
import { ouvrirSession } from '../e2e/session.ts'
import { fichesDuDepot, jouerLaRestitution, ouvrirLeBloc, reussirLaPratique } from './parcours.ts'

const B01 = fichesDuDepot().find((manifeste) => manifeste.bloc === 'B01')
if (B01 === undefined) throw new Error('Le dépôt n’a pas de fiche B01.')

test.describe('bloc complet sur l’API réelle', () => {
  test.beforeEach(async ({ request }) => {
    await remettreAZero(request)
  })

  test('restitution puis pratique : le bloc est acquis provisoirement', async ({ page }) => {
    await ouvrirSession(page)

    await jouerLaRestitution(page, B01)
    await reussirLaPratique(page.request, B01)

    await ouvrirLeBloc(page, 'B01')
    await expect(page.getByRole('heading', { level: 1, name: B01.titre })).toBeVisible()
    await expect(page.getByText('Acquis provisoirement', { exact: true })).toBeVisible()
  })
})
