import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { ouvrirSession } from './session.ts'

// Les autres spécifications bloquent le service worker : celle-ci l'utilise.
test.use({ serviceWorkers: 'allow' })

const FICHE = './fiches/demo/fiche-demo.html'

async function attendreLeControle(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true)
}

test.describe('appli installable et hors ligne', () => {
  test('le manifeste décrit une appli installable', async ({ page, request }) => {
    await page.goto('./')
    const adresse = await page.locator('link[rel="manifest"]').getAttribute('href')
    const reponse = await request.get(adresse ?? '')
    const manifeste = (await reponse.json()) as Record<string, unknown>

    expect(manifeste).toMatchObject({
      name: 'Atelier',
      short_name: 'Atelier',
      start_url: './',
      scope: './',
      display: 'standalone',
    })
    const icones = manifeste['icons'] as { sizes: string; purpose?: string }[]
    expect(
      icones.map(({ sizes, purpose }) => `${sizes}${purpose === undefined ? '' : ` ${purpose}`}`),
    ).toEqual(['192x192', '512x512', '512x512 maskable'])
  })

  test('après une première visite, l’appli et une fiche ouverte se rechargent sans réseau', async ({
    page,
    context,
  }) => {
    await ouvrirSession(page)
    await attendreLeControle(page)
    await page.goto(FICHE)
    await expect(page.getByRole('status').first()).toHaveText('Mode autonome', { timeout: 5000 })

    await context.setOffline(true)

    await page.reload()
    await expect(page.getByRole('status').first()).toHaveText('Mode autonome', { timeout: 5000 })

    await page.goto('./#/')
    await expect(page.getByRole('heading', { level: 1, name: 'Aujourd’hui' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Aujourd’hui' })).toBeVisible()
  })
})
