import { readFileSync } from 'node:fs'
import { expect } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { avancer } from './banc.ts'

export interface Question {
  readonly id: string
  readonly attendu: string
}
interface Manifeste {
  readonly restitution: readonly Question[]
  readonly consolidation: readonly Question[]
  readonly pratique: readonly { readonly id: string; readonly items: readonly { id: string }[] }[]
}

export const MANIFESTE = JSON.parse(
  readFileSync(
    new URL('../../../packages/contrats/fixtures/manifeste-demo.json', import.meta.url),
    'utf8',
  ),
) as Manifeste
export const ORIGINE = 'http://localhost:4173'
export const HEURE_MS = 3_600_000

export async function connecter(page: Page) {
  await page.goto('./#/connexion')
  await page.getByLabel('Nom d’utilisateur').fill('amine')
  await page.getByLabel('Mot de passe', { exact: true }).fill('demo-janus')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Aujourd’hui' })).toBeVisible()
}

/** Ouvre B01 dans la fiche, sur l'étape demandée. */
export async function ouvrirEtape(page: Page, etape: string) {
  await page.goto('./#/blocs/B01')
  // Un changement d'adresse à ancre ne recharge pas la page : on relit l'état du bloc au serveur.
  await page.reload()
  const fiche = page.frameLocator('iframe[title^="Fiche du bloc B01"]')
  await expect(fiche.getByRole('status').filter({ hasText: 'Dans l’appli' })).toBeVisible()
  await fiche.getByRole('button', { name: etape }).click()
  return fiche
}

/** Répond à chaque question de la série affichée, avec la réponse attendue du manifeste. */
export async function repondreALaSerie(page: Page, etape: string, questions: readonly Question[]) {
  const fiche = await ouvrirEtape(page, etape)
  const items = fiche.locator('.item')
  await expect(items).toHaveCount(questions.length)
  for (const [rang, question] of questions.entries()) {
    const item = items.nth(rang)
    await item
      .locator('textarea')
      .fill(`${question.attendu} Voilà ce que j’en retiens, avec mes mots.`)
    await item.getByLabel('Sûr').check()
    await item.getByRole('button', { name: 'Envoyer' }).click()
    await expect(item.locator('.correction')).toBeVisible()
  }
}

/**
 * Mène B01 à « acquis provisoirement » : restitution, consolidation une heure plus tard, puis les
 * résultats de la pratique et de l'atelier, que la fiche enverrait.
 */
export async function acquerirB01(page: Page, request: APIRequestContext) {
  await repondreALaSerie(page, 'Restitution', MANIFESTE.restitution)
  await avancer(request, HEURE_MS + 60_000)
  await repondreALaSerie(page, 'Consolidation', MANIFESTE.consolidation)
  const detail = await page.request.get('/api/blocs/B01')
  const { version } = (await detail.json()) as { version: number }
  const message = (corps: Record<string, unknown>) =>
    page.request.post('/api/evenements', {
      headers: { Origin: ORIGINE },
      data: { bloc: 'B01', version, t: '2026-06-01T10:00:00Z', ...corps },
    })
  let numero = 0
  const id = () => `0190a000-0000-7000-8000-${(numero += 1).toString(16).padStart(12, '0')}`
  for (const exercice of MANIFESTE.pratique) {
    for (const item of exercice.items) {
      const reponse = await message({
        id: id(),
        type: 'pratique.resultat',
        exercice: exercice.id,
        item: item.id,
        reussi: true,
        aide: 0,
        essais: 1,
      })
      expect(reponse.ok()).toBe(true)
    }
  }
  const atelier = await message({
    id: id(),
    type: 'atelier.resultat',
    reussi: true,
    predictions_justes: 3,
    aide: 0,
  })
  expect(atelier.ok()).toBe(true)
}
