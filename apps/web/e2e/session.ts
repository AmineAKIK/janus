import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect } from '@playwright/test'
import type { FrameLocator, Locator, Page, test } from '@playwright/test'

/** Ouvre une session de démonstration par l'écran de connexion, comme le ferait Amine. */
export async function ouvrirSession(page: Page): Promise<void> {
  await page.goto('./#/connexion')
  await page.getByLabel('Nom d’utilisateur').fill('amine')
  await page.getByLabel('Mot de passe', { exact: true }).fill('demo-janus')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Aujourd’hui' })).toBeVisible()
}

/** La fiche d'un bloc, dans l'iframe de sa page. */
export function ficheDuBloc(page: Page, bloc: string): FrameLocator {
  return page.frameLocator(`iframe[title^="Fiche du bloc ${bloc}"]`)
}

/**
 * Attend que la fiche du bloc ait pris le mode appli (« Dans l’appli ») et la hauteur de son contenu,
 * puis la rend.
 */
export async function attendreFiche(page: Page, bloc: string): Promise<FrameLocator> {
  const fiche = ficheDuBloc(page, bloc)
  await expect(fiche.getByRole('status').filter({ hasText: 'Dans l’appli' })).toBeVisible()
  await ficheALaHauteur(page, bloc)
  return fiche
}

/**
 * L'iframe de la fiche a la hauteur du contenu de la fiche : rien n'est coupé, rien ne défile dans
 * la fiche. Sans bloc, la première fiche de la page.
 */
export async function ficheALaHauteur(page: Page, bloc = ''): Promise<void> {
  const cadre = page.locator(`iframe[title^="Fiche du bloc ${bloc}"]`).first()
  const contenu = cadre.contentFrame().locator('html')
  await expect
    .poll(async () => {
      const [hauteurCadre, hauteurContenu] = await Promise.all([
        cadre.evaluate((iframe) => iframe.getBoundingClientRect().height),
        contenu.evaluate((racine) => Math.ceil(racine.getBoundingClientRect().height)),
      ])
      return hauteurCadre - hauteurContenu
    })
    .toBe(0)
}

/** Active des interrupteurs de démo (états Figma qui dépendent du serveur) puis recharge l'appli. */
export async function activerInterrupteurs(page: Page, noms: readonly string[]): Promise<void> {
  await page.evaluate((interrupteurs) => {
    const cle = 'janus.demo.v1'
    const etat = JSON.parse(localStorage.getItem(cle) ?? 'null') as {
      interrupteurs: Record<string, boolean>
    }
    for (const nom of interrupteurs) etat.interrupteurs[nom] = true
    localStorage.setItem(cle, JSON.stringify(etat))
  }, noms)
  await page.reload()
}

/** Le bouton d'une étape dans le fil de la page (la fiche intégrée n'a plus de fil à elle). */
export function etape(page: Page, nom: string): Locator {
  // Étroit, le fil est replié derrière un bouton : l'ouvrir est un clic comme un autre (voir `ouvrirFil`).
  return page
    .getByRole('navigation', { name: 'Étapes de la fiche' })
    .getByRole('button', { name: new RegExp(`${nom}$`) })
}

/**
 * Attend que le serveur ait recalculé le statut après la dernière réponse d'une série : la fiche
 * affiche alors le statut attendu (« Vu » après la restitution, par exemple).
 */
export async function serieEnregistree(page: Page, statut: string): Promise<void> {
  await expect(page.frameLocator('iframe').getByText(`Statut : ${statut}`)).toBeVisible()
}

/**
 * Clique un élément de la page, hors de la fiche. La fiche prend toute sa hauteur : juste après un
 * défilement, Chromium peut encore router le clic vers l'iframe (un autre processus). On amène
 * l'élément à l'écran et on laisse le navigateur peindre la nouvelle position avant de cliquer.
 */
export async function cliquerHorsFiche(cible: Locator): Promise<void> {
  await cible.scrollIntoViewIfNeeded()
  await cible.evaluate(
    () =>
      new Promise<void>((fin) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            fin()
          })
        })
      }),
  )
  await cible.click()
}

/** Ouvre une étape et attend que la fiche l'ait affichée : ce qu'on lit ensuite est celui de l'étape. */
export async function allerEtape(page: Page, nom: string): Promise<void> {
  await ouvrirFil(page)
  await cliquerHorsFiche(etape(page, nom))
  // Étroit, le fil se replie après le choix : on le rouvre pour lire l'étape courante, puis on le referme.
  await ouvrirFil(page)
  await expect(etape(page, nom)).toHaveAttribute('aria-current', 'step')
  const bascule = page
    .getByRole('navigation', { name: 'Étapes de la fiche' })
    .getByRole('button', { expanded: true })
  if (await bascule.isVisible()) await cliquerHorsFiche(bascule)
}

/** Étroit, le fil des étapes est replié derrière un bouton ; large, il n'y a rien à ouvrir. */
export async function ouvrirFil(page: Page): Promise<void> {
  const bascule = page
    .getByRole('navigation', { name: 'Étapes de la fiche' })
    .getByRole('button', { expanded: false })
    .first()
  if (await bascule.isVisible()) await cliquerHorsFiche(bascule)
}

/** Clique une étape du fil, replié ou non, sans attendre que la fiche l'affiche. */
export async function cliquerEtape(page: Page, nom: string): Promise<void> {
  await ouvrirFil(page)
  await cliquerHorsFiche(
    page
      .getByRole('navigation', { name: 'Étapes de la fiche' })
      .getByRole('button', { name: nom, exact: true }),
  )
}

/**
 * Quand un test de la suite échoue, écrit `diagnostic.txt` à côté de sa trace : la console du
 * navigateur et le texte de la fiche. Le rapport de Playwright ne dit ni l'un ni l'autre (son arbre
 * d'accessibilité s'arrête à l'iframe), et c'est ce qu'il faut lire quand la fiche n'a pas réagi.
 */
export function diagnostiquerLesEchecs(suite: typeof test): void {
  const journaux = new WeakMap<Page, string[]>()
  suite.beforeEach(({ page }) => {
    const lignes: string[] = []
    page.on('console', (message) => {
      lignes.push(`[console ${message.type()}] ${message.text()}`)
    })
    page.on('pageerror', (erreur) => {
      lignes.push(`[pageerror] ${erreur.message}`)
    })
    // Les appels refusés ou perdus : un 409 ou un 401 dans la file d'envoi ne se voit pas ailleurs.
    page.on('load', () => {
      lignes.push(`[page chargée] ${page.url()}`)
    })
    page.on('response', async (reponse) => {
      const requete = reponse.request()
      // L'état d'une page : la version lue, envoyée et rendue, qui dit d'où vient un 409.
      if (requete.method() === 'PUT' && requete.url().endsWith('/etat-page')) {
        const envoyee = (requete.postDataJSON() as { version?: number } | null)?.version
        const rendue = await reponse
          .json()
          .then((corps: { version?: number }) => String(corps.version))
          .catch(() => '?')
        lignes.push(
          `[état ${String(reponse.status())}] ${requete.url()} : version envoyée ${String(envoyee)}, serveur ${rendue}`,
        )
        return
      }
      if (requete.method() === 'GET' && /\/api\/blocs\/[^/]+$/u.test(requete.url())) {
        const lue = await reponse
          .json()
          .then((corps: { etat_page?: { version?: number } | null }) =>
            String(corps.etat_page?.version ?? 0),
          )
          .catch(() => '?')
        lignes.push(`[lecture ${String(reponse.status())}] ${requete.url()} : version ${lue}`)
        return
      }
      if (reponse.status() >= 400) {
        lignes.push(
          `[réponse ${String(reponse.status())}] ${reponse.request().method()} ${reponse.url()}`,
        )
      }
    })
    page.on('requestfailed', (requete) => {
      lignes.push(
        `[requête perdue] ${requete.method()} ${requete.url()} : ${requete.failure()?.errorText ?? ''}`,
      )
    })
    journaux.set(page, lignes)
  })
  suite.afterEach(async ({ page }, info) => {
    if (info.status === info.expectedStatus) return
    const fiche = await page
      .frameLocator('iframe')
      .locator('body')
      .innerText({ timeout: 2000 })
      .catch((erreur: unknown) => `(fiche illisible : ${String(erreur)})`)
    mkdirSync(info.outputDir, { recursive: true })
    writeFileSync(
      join(info.outputDir, 'diagnostic.txt'),
      [
        '== Console du navigateur',
        ...(journaux.get(page) ?? []),
        '',
        '== Texte de la fiche',
        fiche,
        '',
      ].join('\n'),
    )
  })
}
