import { expect, test } from '@playwright/test'
import { ecrans } from './ecrans.ts'
import { activerInterrupteurs, ouvrirSession } from './session.ts'

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
        if (ecran.session !== false && ecran.chemin.startsWith('./#/')) await ouvrirSession(page)
        await page.goto(ecran.chemin)
        if (ecran.interrupteurs !== undefined) await activerInterrupteurs(page, ecran.interrupteurs)
        await expect(page.getByRole('heading', { level: 1, name: ecran.etat })).toBeVisible()
        await ecran.scenario?.(page)
        for (const nom of ecran.clics ?? []) {
          await page.getByRole('button', { name: nom, exact: true }).click()
        }
        if (ecran.clics !== undefined) await expect(page.getByRole('dialog')).toBeVisible()
        await page.screenshot({
          path: `captures/${ecran.nom}-${String(taille.width)}-${theme.nom}.png`,
          fullPage: true,
        })

        expect(erreurs, 'erreurs dans la console du navigateur').toEqual([])
      })
    }
  }
}
