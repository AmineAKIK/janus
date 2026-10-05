import { expect, test } from '@playwright/test'

const VITRINE = './vitrine.html'
const FOND_CLAIR = 'rgb(247, 244, 238)'
const FOND_SOMBRE = 'rgb(23, 21, 18)'

test('en thème Système, le réglage du téléphone change les couleurs sans recharger', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto(VITRINE)
  await expect(page.locator('body')).toHaveCSS('background-color', FOND_CLAIR)

  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('body')).toHaveCSS('background-color', FOND_SOMBRE)

  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('body')).toHaveCSS('background-color', FOND_CLAIR)
})

test('un thème choisi gagne sur le réglage du téléphone', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto(VITRINE)
  await page.getByLabel('Sombre').check()
  await expect(page.locator('body')).toHaveCSS('background-color', FOND_SOMBRE)
})

test('recharger garde le thème et la taille, sans flash du thème par défaut', async ({ page }) => {
  await page.goto(VITRINE)
  await page.getByLabel('Sombre').check()
  await page.getByLabel('Grand').check()

  // Sans le JavaScript de l'appli, seul le script de index.html peut avoir posé les attributs.
  await page.route('**/assets/*.js', (route) => route.abort())
  await page.reload()

  const racine = page.locator('html')
  await expect(racine).toHaveAttribute('data-theme', 'sombre')
  await expect(racine).toHaveAttribute('data-taille', 'grand')
})

test('en taille Grand, la vitrine ne déborde pas à 390 px', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('janus.affichage.taille', 'grand')
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(VITRINE)
  await expect(page.locator('html')).toHaveAttribute('data-taille', 'grand')

  const debordement = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(debordement).toBeLessThanOrEqual(0)
})

test('aucune requête vers un domaine externe, polices comprises', async ({ page, baseURL }) => {
  const origine = new URL(baseURL ?? 'http://localhost').origin
  const externes: string[] = []
  page.on('request', (requete) => {
    const url = requete.url()
    if (!url.startsWith(origine) && !url.startsWith('data:')) externes.push(url)
  })

  await page.goto(VITRINE)
  await page.evaluate(() => document.fonts.ready)

  expect(externes).toEqual([])
})
