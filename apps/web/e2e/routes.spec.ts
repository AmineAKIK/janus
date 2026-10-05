import { expect, test } from '@playwright/test'
import { ecrans } from './ecrans.ts'
import { activerInterrupteurs, ouvrirSession } from './session.ts'

const ecransDeLAppli = ecrans.filter(({ chemin }) => chemin.startsWith('./#/'))

test.describe('routes', () => {
  for (const ecran of ecransDeLAppli) {
    test(`${ecran.nom} s’ouvre par son adresse directe, aussi après rechargement`, async ({
      page,
    }) => {
      const titre = page.getByRole('heading', { level: 1, name: ecran.etat })

      if (ecran.session !== false) await ouvrirSession(page)
      await page.goto(ecran.chemin)
      if (ecran.interrupteurs !== undefined) await activerInterrupteurs(page, ecran.interrupteurs)
      await expect(titre).toBeVisible()
      await expect(page).toHaveTitle(`${ecran.titre ?? ecran.etat} · Atelier`)

      await page.reload()
      await expect(titre).toBeVisible()
    })
  }

  test('le bouton Retour du navigateur revient d’une route à l’autre', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await ouvrirSession(page)
    const navigation = page.getByRole('navigation', { name: 'Navigation principale' })

    await navigation.getByRole('link', { name: 'Formations' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Formations' })).toBeFocused()
    await navigation.getByRole('link', { name: 'Journal' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Journal' })).toBeFocused()

    await page.goBack()
    await expect(page.getByRole('heading', { level: 1, name: 'Formations' })).toBeVisible()
    await page.goBack()
    await expect(page.getByRole('heading', { level: 1, name: 'Aujourd’hui' })).toBeVisible()
    await expect(page).toHaveTitle('Aujourd’hui · Atelier')
  })

  test('au clavier, le lien d’évitement est le premier arrêt et mène au contenu', async ({
    page,
  }) => {
    await ouvrirSession(page)
    await page.goto('./#/formations')
    // Un rechargement : le focus part du début de la page, comme à l'ouverture de l'appli.
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Formations' })).toBeVisible()
    await page.keyboard.press('Tab')
    const lien = page.getByRole('link', { name: 'Aller au contenu' })

    await expect(lien).toBeFocused()
    await expect(lien).toBeVisible()
    await page.keyboard.press('Enter')

    await expect(page.getByRole('main')).toBeFocused()
    await expect(page).toHaveURL(/#\/formations$/)
  })

  test('l’écran de connexion n’a pas de navigation', async ({ page }) => {
    await page.goto('./#/connexion')

    await expect(page.getByRole('heading', { level: 1, name: 'Atelier' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toHaveCount(0)
  })

  test('la page introuvable renvoie à Aujourd’hui', async ({ page }) => {
    await ouvrirSession(page)
    await page.goto('./#/n-existe-pas')

    await page.getByRole('link', { name: 'Aller à Aujourd’hui' }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Aujourd’hui' })).toBeVisible()
  })
})
