import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { ouvrirSession } from './session'

/**
 * Garde-fous de mise en page : chaque écran de la démo est parcouru à quatre largeurs et dans les
 * deux thèmes. Trois règles : pas de défilement horizontal de la page, pas de textes qui se
 * chevauchent, pas de contrôle qui dépasse le bord droit de l'écran.
 */

interface Parcours {
  readonly nom: string
  readonly chemin: string
  /** Numéro du ticket qui répare cet écran : tant que ce n'est pas fait, le cas est suspendu. */
  readonly aReparer?: string
}

const parcours: readonly Parcours[] = [
  { nom: 'connexion', chemin: './#/connexion' },
  { nom: 'aujourdhui', chemin: './#/' },
  { nom: 'questions', chemin: './#/questions' },
  { nom: 'revision', chemin: './#/revision' },
  { nom: 'formations', chemin: './#/formations' },
  { nom: 'formation', chemin: './#/formations/DWWM' },
  { nom: 'liste-des-blocs', chemin: './#/modules/M1' },
  { nom: 'detail-du-bloc', chemin: './#/modules/M1?detail=B04' },
  { nom: 'bloc', chemin: './#/blocs/B03' },
  {
    nom: 'verification',
    chemin: './#/verifications/0190a000-0000-7000-8000-000423032000',
  },
  { nom: 'suivi', chemin: './#/tableau-de-bord' },
  { nom: 'journal', chemin: './#/journal' },
  { nom: 'parametres', chemin: './#/parametres' },
  { nom: 'parametres-section', chemin: './#/parametres/revision' },
  { nom: 'introuvable', chemin: './#/n-existe-pas' },
]

const largeurs = [320, 375, 768, 1280] as const
const themes = ['light', 'dark'] as const

interface Probleme {
  readonly regle: string
  readonly detail: string
}

/** Mesure la page dans le navigateur et renvoie la liste des problèmes constatés. */
async function mesurer(page: Page): Promise<readonly Probleme[]> {
  return page.evaluate((): Probleme[] => {
    const problemes: Probleme[] = []
    const largeur = window.innerWidth

    const debordement = document.documentElement.scrollWidth - largeur
    if (debordement > 0) {
      problemes.push({
        regle: 'defilement-horizontal',
        detail: `la page dépasse de ${String(debordement)} px`,
      })
    }

    const visible = (element: Element): boolean => {
      // Contenu d'un <details> refermé : pas à l'écran, même s'il garde un rectangle.
      if (!element.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true })) {
        return false
      }
      const style = getComputedStyle(element)
      if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') {
        return false
      }
      const rect = element.getBoundingClientRect()
      // Texte réservé aux lecteurs d'écran : 1 px de côté, il n'est pas à l'écran.
      return rect.width > 1 && rect.height > 1
    }
    const decrit = (element: Element): string =>
      `${element.tagName.toLowerCase()} « ${element.textContent.trim().slice(0, 30)} »`

    // Contrôles qui dépassent le bord droit (hors zones qui défilent volontairement).
    const defilant = (element: Element): boolean => {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const { overflowX } = getComputedStyle(parent)
        if ((overflowX === 'auto' || overflowX === 'scroll') && parent !== document.body) {
          return true
        }
      }
      return false
    }
    for (const element of document.querySelectorAll('a, button, input, select, textarea')) {
      if (!visible(element) || defilant(element)) continue
      const rect = element.getBoundingClientRect()
      if (rect.right > largeur + 1) {
        problemes.push({
          regle: 'controle-hors-ecran',
          detail: `${decrit(element)} dépasse de ${String(Math.round(rect.right - largeur))} px`,
        })
      }
    }

    // Textes qui se chevauchent : on compare les rectangles du texte lui-même, pas ceux des boîtes.
    // Les éléments fixes (barre de navigation du mobile) passent par-dessus le contenu qui défile :
    // ils ne comptent pas.
    const fixe = (element: Element): boolean => {
      for (let parent: Element | null = element; parent; parent = parent.parentElement) {
        if (getComputedStyle(parent).position === 'fixed') return true
      }
      return false
    }
    const textes: { element: Element; rect: DOMRect }[] = []
    for (const element of document.querySelectorAll('body *')) {
      if (!visible(element) || element.closest('[data-superpose]') || fixe(element)) continue
      for (const noeud of element.childNodes) {
        if (noeud.nodeType !== Node.TEXT_NODE || (noeud.textContent ?? '').trim() === '') continue
        const plage = document.createRange()
        plage.selectNodeContents(noeud)
        for (const rect of plage.getClientRects()) {
          if (rect.width > 0 && rect.height > 0) textes.push({ element, rect })
        }
      }
    }
    for (let i = 0; i < textes.length; i += 1) {
      for (let j = i + 1; j < textes.length; j += 1) {
        const a = textes[i]
        const b = textes[j]
        if (a === undefined || b === undefined || a.element === b.element) continue
        const recouvrementX =
          Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left)
        const recouvrementY =
          Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top)
        if (recouvrementX > 2 && recouvrementY > 2) {
          problemes.push({
            regle: 'textes-superposes',
            detail: `${decrit(a.element)} chevauche ${decrit(b.element)}`,
          })
        }
      }
    }
    return problemes
  })
}

for (const theme of themes) {
  for (const largeur of largeurs) {
    test.describe(`mise en page ${String(largeur)} px, thème ${theme}`, () => {
      test.use({ viewport: { width: largeur, height: 800 }, colorScheme: theme })

      for (const ecran of parcours) {
        test(ecran.nom, async ({ page }) => {
          if (ecran.aReparer !== undefined) {
            test.fixme(true, `Défaut connu, réparé par ${ecran.aReparer}.`)
          }
          await ouvrirSession(page)
          await page.goto(ecran.chemin)
          await expect(page.locator('main, [role="main"]').first()).toBeVisible()
          await page.evaluate(() => document.fonts.ready)

          const problemes = await mesurer(page)
          expect(problemes, JSON.stringify(problemes, null, 2)).toEqual([])
        })
      }
    })
  }
}

for (const largeur of [320, 1280]) {
  test.describe(`page de bloc à ${String(largeur)} px`, () => {
    test.use({ viewport: { width: largeur, height: 800 } })

    test('toutes les étapes sont visibles en entier, sans défilement, et le nom du bloc aussi', async ({
      page,
    }) => {
      await ouvrirSession(page)
      await page.goto('./#/blocs/B03')
      const onglets = page
        .getByRole('navigation', { name: 'Étapes de la fiche' })
        .getByRole('button')
      await expect(onglets.first()).toBeVisible()
      for (const onglet of await onglets.all()) {
        await expect(onglet).toBeInViewport({ ratio: 1 })
      }
      await expect(page.getByRole('heading', { level: 1 })).toBeInViewport()
    })
  })
}
