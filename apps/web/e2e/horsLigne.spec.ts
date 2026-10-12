import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { ouvrirSession } from './session.ts'

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
      name: 'Janus',
      short_name: 'Janus',
      start_url: './',
      scope: './',
      display: 'standalone',
    })
    const icones = manifeste['icons'] as { sizes: string; purpose?: string }[]
    expect(
      icones.map(({ sizes, purpose }) => `${sizes}${purpose === undefined ? '' : ` ${purpose}`}`),
    ).toEqual(['192x192', '512x512', '512x512 maskable', '512x512 monochrome'])

    // Tout ce que le manifeste annonce existe : icônes, captures de la boîte d'installation, raccourcis.
    const fichiers = [
      ...icones.map((icone) => (icone as unknown as { src: string }).src),
      ...(manifeste['screenshots'] as { src: string }[]).map(({ src }) => src),
    ]
    for (const src of fichiers) {
      const image = await request.get(new URL(src, reponse.url()).href)
      expect(image.ok(), src).toBe(true)
      expect(image.headers()['content-type'], src).toContain('image/png')
    }
    expect(manifeste['id']).toBeTruthy()
    const raccourcis = manifeste['shortcuts'] as { name: string }[]
    expect(raccourcis.map(({ name }) => name)).toEqual(['Aujourd’hui', 'Révision', 'Journal'])
  })

  test('la barre du navigateur suit le thème de l’appli', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('janus.affichage.theme', 'sombre')
    })
    await page.goto('./')
    const couleurs = await page
      .locator('meta[name="theme-color"]')
      .evaluateAll((balises) => balises.map((balise) => balise.getAttribute('content')))
    expect(couleurs).toEqual(['#14171a', '#14171a'])
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
