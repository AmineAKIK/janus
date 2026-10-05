import { expect, test } from '@playwright/test'
import { ecrans } from './ecrans.ts'

const tailles = [
  { nom: 'mobile', width: 390, height: 844 },
  { nom: 'bureau', width: 1440, height: 900 },
] as const

const themes = [
  { nom: 'clair', colorScheme: 'light' },
  { nom: 'sombre', colorScheme: 'dark' },
] as const

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
        await page.goto(ecran.chemin)
        if (ecran.etat !== undefined) {
          await expect(page.getByText(ecran.etat, { exact: true })).toBeVisible()
        }
        await page.screenshot({
          path: `captures/${ecran.nom}-${String(taille.width)}-${theme.nom}.png`,
          fullPage: true,
        })

        expect(erreurs, 'erreurs dans la console du navigateur').toEqual([])
      })
    }
  }
}
