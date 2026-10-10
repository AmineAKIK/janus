import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { allerEtape, ouvrirSession } from './session.ts'

const FICHE = 'iframe[title^="Fiche du bloc B03"]'

/** Les messages gardés dans IndexedDB, lus comme le ferait un autre onglet. */
async function gardes(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const ouverture = indexedDB.open('janus', 1)
        ouverture.onerror = () => {
          reject(new Error('IndexedDB'))
        }
        ouverture.onsuccess = () => {
          const base = ouverture.result
          if (!base.objectStoreNames.contains('boite_envoi')) {
            resolve(0)
            return
          }
          const compte = base.transaction('boite_envoi').objectStore('boite_envoi').count()
          compte.onsuccess = () => {
            base.close()
            resolve(compte.result)
          }
        }
      }),
  )
}

async function ouvrirBloc(page: Page) {
  await page.goto('./#/blocs/B03')
  const fiche = page.frameLocator(FICHE)
  await expect(fiche.getByRole('status').filter({ hasText: 'Dans l’appli' })).toBeVisible()
  return fiche
}

async function parcourirEtapes(page: Page, titres: readonly string[]) {
  for (const titre of titres) await allerEtape(page, titre)
}

test.describe('boîte d’envoi', () => {
  test.beforeEach(async ({ page }) => {
    await ouvrirSession(page)
  })

  test('hors connexion les messages sont gardés, au retour du réseau ils partent', async ({
    page,
  }) => {
    await ouvrirBloc(page)
    await page.evaluate(() => window.__janusDemo?.interrupteur('horsConnexion', true))

    await parcourirEtapes(page, ['Explication', 'Pratique guidée', 'Restitution'])
    await expect.poll(() => gardes(page)).toBeGreaterThanOrEqual(3)

    await page.evaluate(() => window.__janusDemo?.interrupteur('horsConnexion', false))
    await page.evaluate(() => {
      window.dispatchEvent(new Event('online'))
    })
    await expect.poll(() => gardes(page)).toBe(0)
  })

  test('fermer l’onglet hors connexion puis rouvrir en ligne envoie les messages gardés', async ({
    page,
  }) => {
    await ouvrirBloc(page)
    await page.evaluate(() => window.__janusDemo?.interrupteur('horsConnexion', true))
    await parcourirEtapes(page, ['Explication', 'Pratique guidée'])
    await expect.poll(() => gardes(page)).toBeGreaterThanOrEqual(2)

    // Le réseau revient pendant que l'onglet est fermé : la démo repart sans interrupteur.
    await page.evaluate(() => {
      const cle = 'janus.demo.v1'
      const etat = JSON.parse(localStorage.getItem(cle) ?? 'null') as {
        interrupteurs: Record<string, boolean>
      }
      etat.interrupteurs['horsConnexion'] = false
      localStorage.setItem(cle, JSON.stringify(etat))
    })
    await page.goto('about:blank')
    await page.goto('./#/')

    await expect.poll(() => gardes(page)).toBe(0)
  })

  test('un seul onglet envoie à la fois', async ({ page, context }) => {
    await ouvrirBloc(page)
    const autre = await context.newPage()
    await autre.goto('./#/')
    await expect(autre.getByRole('heading', { level: 1, name: 'Aujourd’hui' })).toBeVisible()

    // L'autre onglet tient le verrou d'envoi : rien ne peut partir de celui-ci.
    await autre.evaluate(() => {
      void navigator.locks.request(
        'janus-envoi',
        () =>
          new Promise<void>((resolve) => {
            window.addEventListener('liberer-verrou', () => {
              resolve()
            })
          }),
      )
    })
    await parcourirEtapes(page, ['Explication'])
    await expect.poll(() => gardes(page)).toBeGreaterThanOrEqual(1)
    await page.waitForTimeout(500)
    expect(await gardes(page)).toBeGreaterThanOrEqual(1)

    await autre.evaluate(() => {
      window.dispatchEvent(new Event('liberer-verrou'))
    })
    await expect.poll(() => gardes(page)).toBe(0)
  })
})
