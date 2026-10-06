import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

interface Reponse {
  readonly ok: boolean
  readonly sortie?: unknown
  readonly erreur?: string
}

/** Parle à `executeur.html` comme le fait l'appli : une iframe cachée, un message, une réponse. */
async function executer(
  page: Page,
  code: string,
  entrees: readonly (readonly unknown[])[],
  delaiMs = 2000,
): Promise<readonly Reponse[]> {
  return page.evaluate(
    ({ code: source, entrees: lots, delaiMs: delai }) =>
      new Promise<Reponse[]>((resoudre) => {
        const iframe = document.createElement('iframe')
        iframe.hidden = true
        iframe.setAttribute('sandbox', 'allow-scripts')
        window.addEventListener('message', function ecouter(evenement: MessageEvent<unknown>) {
          if (evenement.source !== iframe.contentWindow) return
          const donnees = evenement.data
          if (typeof donnees !== 'object' || donnees === null || !('type' in donnees)) return
          if (donnees.type === 'pret') {
            iframe.contentWindow?.postMessage(
              {
                type: 'executer',
                id: 'test',
                code: source,
                cas: lots.map((entree) => ({ entree })),
                delaiMs: delai,
              },
              '*',
            )
          } else if (donnees.type === 'resultat' && 'resultats' in donnees) {
            window.removeEventListener('message', ecouter)
            iframe.remove()
            resoudre(Array.isArray(donnees.resultats) ? donnees.resultats : [])
          }
        })
        iframe.src = 'executeur.html'
        document.body.append(iframe)
      }),
    { code, entrees, delaiMs },
  )
}

test.describe('exécuteur de code', () => {
  test('rend la sortie, ou l’erreur levée, de chaque cas', async ({ page }) => {
    await page.goto('./')

    const reponses = await executer(
      page,
      'function somme(a, b) {\n  if (a < 0) throw new Error("négatif")\n  return a + b\n}',
      [
        [1, 2],
        [-1, 2],
      ],
    )

    expect(reponses[0]).toEqual({ ok: true, sortie: 3 })
    expect(reponses[1]?.ok).toBe(false)
    expect(reponses[1]?.erreur).toContain('négatif')
  })

  test('une boucle infinie est arrêtée au bout du délai et l’appli reste utilisable', async ({
    page,
  }) => {
    await page.goto('./')
    const debut = Date.now()

    const reponses = await executer(page, 'function f() { while (true) {} }', [[]], 2000)

    expect(reponses).toEqual([{ ok: false, erreur: 'temps_depasse' }])
    expect(Date.now() - debut).toBeLessThan(4000)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await page.evaluate(() => 1 + 1)).toBe(2)
  })

  test('le code testé ne lit ni cookies ni stockage, et n’a pas de réseau', async ({ page }) => {
    await page.goto('./')
    await page.evaluate(() => {
      document.cookie = 'secret=1'
      localStorage.setItem('secret', '1')
    })

    const reponses = await executer(
      page,
      `async function espion() {
        const vu = { document: typeof document, stockage: typeof localStorage, cookie: String(self.cookieStore) }
        try { await fetch(location.href); vu.reseau = 'ouvert' } catch { vu.reseau = 'ferme' }
        try { vu.base = String(await indexedDB.databases()) } catch { vu.base = 'refuse' }
        return vu
      }`,
      [[]],
    )

    expect(reponses[0]?.sortie).toMatchObject({
      document: 'undefined',
      stockage: 'undefined',
      reseau: 'ferme',
      base: 'refuse',
    })
  })
})
