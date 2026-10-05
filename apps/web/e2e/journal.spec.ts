import { expect, test } from '@playwright/test'

const VITRINE = './vitrine.html'

test.describe('tableau de bord et journal', () => {
  test('une ligne d’événement se déplie et se replie au clavier', async ({ page }) => {
    await page.goto(VITRINE)
    const journal = page.getByRole('region', { name: 'Journal' })
    const bouton = journal.getByRole('button').first()
    await bouton.focus()
    await expect(bouton).toHaveAttribute('aria-expanded', 'false')
    await page.keyboard.press('Enter')
    await expect(bouton).toHaveAttribute('aria-expanded', 'true')
    await page.keyboard.press('Space')
    await expect(bouton).toHaveAttribute('aria-expanded', 'false')
  })

  test('la note de séance se déplie au clavier', async ({ page }) => {
    await page.goto(VITRINE)
    const note = page.getByRole('region', { name: 'Note de séance' })
    const bouton = note.getByRole('button', { name: /Ma note/ }).first()
    await bouton.focus()
    await page.keyboard.press('Enter')
    await expect(note.getByLabel('Ce que j’ai compris').first()).toBeVisible()
  })

  for (const largeur of [390, 1440]) {
    test(`le journal ne déborde pas à ${String(largeur)} px`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 900 })
      await page.goto(VITRINE)
      await page.getByLabel('Grand').check()
      const debordement = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )
      expect(debordement).toBe(false)
    })
  }
})
