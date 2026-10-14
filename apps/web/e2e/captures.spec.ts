import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { ecrans } from './ecrans.ts'
import { activerInterrupteurs, ficheALaHauteur, ouvrirSession } from './session.ts'

const tailles = [
  { nom: 'mobile', width: 390, height: 844 },
  { nom: 'bureau', width: 1440, height: 900 },
] as const

const themes = [
  { nom: 'clair', colorScheme: 'light' },
  { nom: 'sombre', colorScheme: 'dark' },
] as const

/**
 * Chromium échoue parfois à capturer une page entière (« Protocol error (Page.captureScreenshot):
 * Unable to capture screenshot »), sans rapport avec l'écran : on réessaie jusqu'à trois fois.
 */
async function capturer(page: Page, path: string): Promise<void> {
  for (let essai = 1; ; essai += 1) {
    try {
      await page.screenshot({ path, fullPage: true })
      return
    } catch (erreur) {
      if (essai === 3) throw erreur
      await page.waitForTimeout(500)
    }
  }
}

for (const ecran of ecrans) {
  for (const taille of tailles) {
    for (const theme of themes) {
      test(`${ecran.nom} ${taille.nom} ${theme.nom}`, async ({ page }) => {
        const erreurs: string[] = []
        page.on('console', (message) => {
          if (message.type() === 'error') erreurs.push(message.text())
        })
        page.on('pageerror', (erreur) => erreurs.push(erreur.message))

        await page.setViewportSize({ width: taille.width, height: taille.height })
        await page.emulateMedia({ colorScheme: theme.colorScheme })
        if (ecran.session !== false && ecran.chemin.startsWith('./#/')) await ouvrirSession(page)
        await page.goto(ecran.chemin)
        if (ecran.interrupteurs !== undefined) {
          // L'écran se charge à la demande : on attend qu'il ait fini avant de toucher à l'état de la démo.
          await page.waitForLoadState('networkidle')
          await activerInterrupteurs(page, ecran.interrupteurs)
        }
        await expect(page.getByRole('heading', { level: 1, name: ecran.etat })).toBeVisible()
        await ecran.scenario?.(page)
        for (const nom of ecran.clics ?? []) {
          await page.getByRole('button', { name: nom, exact: true }).click()
        }
        if (ecran.clics !== undefined) await expect(page.getByRole('dialog').last()).toBeVisible()
        // Une fiche prête prend la hauteur de son contenu un peu après s'être affichée : on l'attend.
        const fichePrete = page
          .locator('iframe[title^="Fiche du bloc "]')
          .first()
          .contentFrame()
          .getByRole('status')
          .filter({ hasText: 'Dans l’appli' })
        if (await fichePrete.isVisible()) await ficheALaHauteur(page)
        await capturer(page, `captures/${ecran.nom}-${String(taille.width)}-${theme.nom}.png`)

        expect(erreurs, 'erreurs dans la console du navigateur').toEqual([])
      })
    }
  }
}
