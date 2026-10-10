import { expect, test } from '@playwright/test'
import { allerEtape, etape, ouvrirSession, serieEnregistree } from './session.ts'

test.describe('page d’un bloc', () => {
  test.beforeEach(async ({ page }) => {
    await ouvrirSession(page)
  })

  test('la fiche de démo passe en mode appli', async ({ page }) => {
    await page.goto('./#/blocs/B03')

    const fiche = page.frameLocator('iframe[title^="Fiche du bloc B03"]')
    await expect(fiche.getByRole('status').filter({ hasText: 'Dans l’appli' })).toBeVisible()
    await expect(page.getByText('Chargement de la fiche…')).toHaveCount(0)
  })

  test('un message qui ne vient pas de la fiche est ignoré', async ({ page }) => {
    const avertissements: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'warning') avertissements.push(message.text())
    })
    await page.goto('./#/blocs/B03')
    await expect(
      page.frameLocator('iframe').getByRole('status').filter({ hasText: 'Dans l’appli' }),
    ).toBeVisible()

    await page.evaluate(() => {
      window.postMessage({ type: 'page.prete', schema: 2 }, '*')
    })

    await expect.poll(() => avertissements.join('\n')).toContain('source_inconnue')
  })

  test('recharger la page remet la fiche dans l’état sauvegardé', async ({ page }) => {
    await page.goto('./#/blocs/B03')
    const fiche = page.frameLocator('iframe[title^="Fiche du bloc B03"]')
    await expect(fiche.getByRole('status').filter({ hasText: 'Dans l’appli' })).toBeVisible()

    await allerEtape(page, 'Pratique guidée')
    await expect(etape(page, 'Pratique guidée')).toHaveAttribute('aria-current', 'step')
    // La fiche groupe ses sauvegardes.
    await page.waitForTimeout(2500)
    await page.reload()

    await expect(etape(page, 'Pratique guidée')).toHaveAttribute('aria-current', 'step')
  })

  test('le retour ramène à la liste des blocs, bloc choisi', async ({ page }) => {
    await page.goto('./#/blocs/B03')

    await page.getByRole('link', { name: 'Retour aux blocs' }).click()

    await expect(page).toHaveURL(/#\/modules\/M1\?detail=B03$/)
  })

  test('cliquer un onglet du fil affiche l’étape dans la fiche', async ({ page }) => {
    await page.goto('./#/blocs/B03')
    const fiche = page.frameLocator('iframe[title^="Fiche du bloc B03"]')
    await expect(fiche.getByRole('status').filter({ hasText: 'Dans l’appli' })).toBeVisible()

    await page
      .getByRole('navigation', { name: 'Étapes de la fiche' })
      .getByRole('button', { name: 'Pratique guidée' })
      .click()

    await expect(etape(page, 'Pratique guidée')).toHaveAttribute('aria-current', 'step')
    await expect(
      page
        .getByRole('navigation', { name: 'Étapes de la fiche' })
        .getByRole('button', { name: 'Pratique guidée' }),
    ).toHaveAttribute('aria-current', 'step')
  })

  test('pendant la restitution, revoir le cours demande confirmation', async ({ page }) => {
    await page.goto('./#/blocs/B03')
    const fiche = page.frameLocator('iframe[title^="Fiche du bloc B03"]')
    await expect(fiche.getByRole('status').filter({ hasText: 'Dans l’appli' })).toBeVisible()
    const fil = page.getByRole('navigation', { name: 'Étapes de la fiche' })

    await allerEtape(page, 'Restitution')
    await fil.getByRole('button', { name: 'Explication' }).click()

    const dialogue = page.getByRole('dialog', { name: 'Revoir le cours maintenant ?' })
    await expect(dialogue.getByRole('button', { name: 'Rester' })).toBeFocused()
    await dialogue.getByRole('button', { name: 'Rester' }).click()
    await expect(dialogue).toHaveCount(0)

    await fil.getByRole('button', { name: 'Explication' }).click()
    await page.getByRole('button', { name: 'Revoir le cours' }).click()
    await expect(etape(page, 'Explication')).toHaveAttribute('aria-current', 'step')
  })

  test('B03 de bout en bout : restitution, consolidation, bilan', async ({ page }) => {
    await page.goto('./#/blocs/B03')
    const fiche = page.frameLocator('iframe[title^="Fiche du bloc B03"]')
    await expect(fiche.getByRole('status').filter({ hasText: 'Dans l’appli' })).toBeVisible()
    const fil = page.getByRole('navigation', { name: 'Étapes de la fiche' })

    const repondre = async () => {
      const items = fiche.locator('.item')
      const nombre = await items.count()
      for (let rang = 0; rang < nombre; rang++) {
        const item = items.nth(rang)
        const libelle = await item.locator('strong').first().innerText()
        await item
          .locator('textarea')
          .fill(
            `Réponse attendue : ${libelle} . Je l’explique avec mes propres mots, en détail, comme si je devais l’apprendre à un camarade qui n’a pas suivi le cours.`,
          )
        await item.getByLabel('Sûr').check()
        await item.getByRole('button', { name: 'Envoyer' }).click()
        await expect(item.locator('.correction')).toBeVisible()
      }
      await serieEnregistree(page)
    }

    await allerEtape(page, 'Pratique guidée')
    for (let item = 0; item < 3; item++) {
      await fiche.getByRole('button', { name: 'J’ai réussi' }).nth(item).click()
      await expect(fiche.getByText('Envoyé : réussi, aide 0')).toHaveCount(item + 1)
    }
    await allerEtape(page, 'Atelier')
    await fiche.getByRole('button', { name: 'Atelier réussi sans aide' }).click()
    await expect(fiche.getByText('Envoyé : réussi, aide 0')).toBeVisible()

    await allerEtape(page, 'Restitution')
    await repondre()
    await allerEtape(page, 'Consolidation')
    await expect(page.getByText(/Consolidation disponible à/)).toBeVisible()
    await expect(page.getByText('Au moins 1 h après la restitution.')).toBeVisible()

    await page.evaluate(() => window.__janusDemo?.avancer(61 * 60 * 1000))
    await expect(page.getByText(/Consolidation disponible à/)).toHaveCount(0)

    await allerEtape(page, 'Consolidation')
    await repondre()
    await fil.getByRole('button', { name: 'Bilan' }).click()
    await expect(page.getByText('Statut calculé')).toBeVisible()
    await expect(page.getByText(/Statut calculé/)).toContainText('Acquis provisoirement')
    await expect(
      page.getByText(/La vérification sera possible à partir de \d{1,2} \S+ à \d{1,2} h \d{2}\./),
    ).toBeVisible()
  })
})
