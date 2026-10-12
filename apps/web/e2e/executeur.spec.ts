import { readFileSync } from 'node:fs'
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

/** Les politiques de sécurité que le Caddyfile de production pose, lues telles quelles. */
function politiquesDeProduction() {
  const caddyfile = readFileSync(new URL('../../../deploy/vps/Caddyfile', import.meta.url), 'utf8')
  const appli = caddyfile.split('http://fiches.')[0] ?? ''
  const pour = (bloc: string) => {
    const debut = appli.indexOf(bloc)
    const politique = /Content-Security-Policy "([^"]+)"/.exec(appli.slice(debut))?.[1]
    if (debut < 0 || politique === undefined) throw new Error(`Politique introuvable : ${bloc}`)
    return politique
  }
  return { executeur: pour('handle /executeur.html'), appli: pour('\n    handle {') }
}

test.describe('exécuteur de code derrière la politique de production', () => {
  test.use({ serviceWorkers: 'block' })

  test.beforeEach(async ({ page }) => {
    const politiques = politiquesDeProduction()
    // Chaque document et chaque iframe reçoit l'en-tête que Caddy poserait, et le navigateur l'applique.
    await page.route('**/*', async (route) => {
      const reponse = await route.fetch()
      const type = reponse.headers()['content-type'] ?? ''
      if (!type.includes('text/html')) return route.fulfill({ response: reponse })
      const executeur = new URL(route.request().url()).pathname.endsWith('/executeur.html')
      return route.fulfill({
        response: reponse,
        headers: {
          ...reponse.headers(),
          'content-security-policy': executeur ? politiques.executeur : politiques.appli,
        },
      })
    })
  })

  test('rend la sortie du code testé, pas un délai dépassé', async ({ page }) => {
    const refus: string[] = []
    page.on('console', (message) => {
      if (/Content Security Policy|Refused to/.test(message.text())) refus.push(message.text())
    })
    await page.goto('./')

    const reponses = await executer(page, 'function somme(a, b) { return a + b }', [[1, 2]], 3000)

    expect(reponses).toEqual([{ ok: true, sortie: 3 }])
    expect(refus).toEqual([])
  })

  test('l’en-tête de l’exécuteur ne laisse encadrer que par l’appli, sans réseau', async ({
    page,
  }) => {
    const politiques = politiquesDeProduction()

    expect(politiques.executeur).toContain("frame-ancestors 'self'")
    expect(politiques.executeur).toContain("connect-src 'none'")
    expect(politiques.executeur).not.toContain('allow-same-origin')
    expect(politiques.appli).toContain("frame-src 'self' https://fiches.")
    await page.goto('./')
  })
})
