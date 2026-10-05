import { expect, test } from '@playwright/test'

const FICHE = './fiches/demo/fiche-demo.html'
const REPONSE_LONGUE =
  'Une fiche contient un bloc de cours découpé en étapes avec un fil, des questions et un statut.'

test.describe('fiche de démonstration', () => {
  test('ouverte seule, passe en mode autonome et reste utilisable', async ({ page }) => {
    const erreurs: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') erreurs.push(message.text())
    })
    await page.goto(FICHE)

    await expect(page.getByRole('status').first()).toHaveText('Mode autonome', { timeout: 5000 })
    await page.getByRole('button', { name: 'Restitution' }).click()
    await expect(page.getByRole('heading', { name: 'Restitution' })).toBeVisible()

    const question = page.locator('.item').first()
    await question.getByRole('textbox').fill(REPONSE_LONGUE)
    await question.getByRole('button', { name: 'Envoyer' }).click()
    await expect(question.getByText('Choisis ta confiance avant d’envoyer.')).toBeVisible()

    await question.getByLabel('Sûr').check()
    await question.getByRole('button', { name: 'Envoyer' }).click()

    await expect(question.getByText(/^Correction simulée \(démo\) :/)).toBeVisible()
    expect(erreurs).toEqual([])
  })

  test('« je ne sais pas » donne pas_encore avec un indice', async ({ page }) => {
    await page.goto(FICHE)
    await expect(page.getByRole('status').first()).toHaveText('Mode autonome', { timeout: 5000 })
    await page.getByRole('button', { name: 'Restitution' }).click()
    const question = page.locator('.item').first()

    await question.getByRole('textbox').fill('Je ne sais pas')
    await question.getByLabel('Au hasard').check()
    await question.getByRole('button', { name: 'Envoyer' }).click()

    await expect(question.getByText('Niveau : pas_encore')).toBeVisible()
    await expect(question.getByText(/Indice/)).toBeVisible()
  })

  test('en restitution, le cours est masqué jusqu’au retour au cours', async ({ page }) => {
    await page.goto(FICHE)
    await expect(page.getByRole('status').first()).toHaveText('Mode autonome', { timeout: 5000 })

    await page.getByRole('button', { name: 'Explication' }).click()
    await expect(page.getByText(/Masqué : la restitution se fait sans le cours/)).toBeVisible()
    await page.getByRole('button', { name: 'Revenir au cours' }).click()

    await expect(page.getByText('La restitution se fait sans le cours')).toBeVisible()
  })

  test('garde l’étape après rechargement', async ({ page }) => {
    await page.goto(FICHE)
    await expect(page.getByRole('status').first()).toHaveText('Mode autonome', { timeout: 5000 })
    await page.getByRole('button', { name: 'Consolidation' }).click()
    await expect(page.getByRole('heading', { name: 'Consolidation' })).toBeVisible()

    await page.reload()

    await expect(page.getByRole('button', { name: 'Consolidation' })).toHaveAttribute(
      'aria-current',
      'step',
      { timeout: 5000 },
    )
  })

  test('dans l’appli, le bloc vient de etat.init et la consolidation suit serie_ouverte', async ({
    page,
  }) => {
    await page.goto('./')
    // Une fausse appli : elle répond à page.prete par etat.init et note ce que la fiche envoie.
    await page.evaluate((fiche) => {
      const recus: unknown[] = []
      Object.assign(window, { recus })
      document.body.innerHTML = `<iframe title="fiche" sandbox="allow-scripts" src="${fiche}" width="800" height="900"></iframe>`
      const cadre = document.querySelector('iframe')
      window.addEventListener('message', (evenement) => {
        if (evenement.source !== cadre?.contentWindow) return
        recus.push(evenement.data)
        const message = evenement.data as { type: string }
        if (message.type === 'page.prete') {
          cadre.contentWindow?.postMessage(
            {
              type: 'etat.init',
              bloc: 'D07',
              version: 5,
              etat: null,
              statut: 'vu',
              serie_ouverte: { restitution: false, consolidation: true },
            },
            '*',
          )
        }
      })
    }, FICHE)
    const fiche = page.frameLocator('iframe')

    await expect(fiche.getByRole('status').first()).toHaveText('Dans l’appli')
    await fiche.getByRole('button', { name: 'Consolidation' }).click()
    await expect(fiche.getByText('Quelle différence entre vu et acquis ?')).toBeVisible()
    await fiche.getByRole('button', { name: 'Restitution' }).click()
    await expect(fiche.getByText('Cette série n’est pas ouverte.')).toBeVisible()

    const recus = await page.evaluate(
      () =>
        (window as unknown as { recus: { type: string; bloc: string; version: number }[] }).recus,
    )
    expect(recus[0]).toMatchObject({ type: 'page.prete', schema: 2 })
    expect(recus.find((message) => message.type === 'etape.vue')).toMatchObject({
      bloc: 'D07',
      version: 5,
    })
  })
})
