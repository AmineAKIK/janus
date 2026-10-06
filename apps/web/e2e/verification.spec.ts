import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { ouvrirSession } from './session.ts'

interface Differee {
  readonly type: string
  readonly consigne: string
  readonly attendu: string
}

const MANIFESTE = JSON.parse(
  readFileSync(
    new URL('../../../packages/contrats/fixtures/manifeste-demo.json', import.meta.url),
    'utf8',
  ),
) as { readonly differees: readonly Differee[] }

const VERIFICATION_B02 = '0190a000-0000-7000-8000-000423032000'

const reponseSolide = (attendu: string) => attendu.split(/\s+/u).reverse().join(' ')

/** Répond à la partie affichée, bien ou mal, comme le ferait Amine. */
async function repondre(page: Page, mal: boolean, precedente?: string): Promise<string> {
  const consignes = page.locator('p.texte-sous-titre-18').first()
  if (precedente !== undefined) await expect(consignes).not.toHaveText(precedente)
  const consigne = await consignes.textContent()
  const differee = MANIFESTE.differees.find((partie) => partie.consigne === consigne)
  if (differee === undefined) throw new Error(`Partie inconnue : ${consigne ?? ''}`)

  if (differee.type === 'tache') {
    const champ = page.getByRole('textbox', { name: /^(Ton code|Ta réponse)$/ })
    await champ.fill(mal ? 'faux' : differee.attendu)
    await page.getByRole('button', { name: 'Envoyer la tâche' }).click()
    return consigne ?? ''
  }
  await page.getByRole('radio', { name: 'Sûr' }).click()
  const libelle = differee.type === 'explication' ? 'Réponse libre' : 'Écris ta réponse ici'
  await page
    .getByRole('textbox', { name: libelle })
    .fill(mal ? 'Je ne sais pas' : reponseSolide(differee.attendu))
  await page.getByRole('button', { name: 'Envoyer', exact: true }).click()
  return consigne ?? ''
}

async function repondreTout(page: Page, mal: boolean) {
  let precedente: string | undefined
  for (let partie = 0; partie < 3; partie += 1) {
    precedente = await repondre(page, mal, precedente)
  }
}

async function commencer(page: Page) {
  await ouvrirSession(page)
  await page.goto(`./#/verifications/${VERIFICATION_B02}`)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Vérification · bloc masqué' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Commencer' }).click()
}

test.describe('vérification', () => {
  test('réussie : trois parties puis le bloc révélé et l’étape suivante', async ({ page }) => {
    await commencer(page)
    await repondreTout(page, false)

    await expect(page.getByRole('heading', { name: 'Vérification réussie' })).toBeVisible()
    await expect(page.getByText('B02 passe à Acquis')).toBeVisible()
    await page.getByRole('button', { name: /^Étape suivante/ }).click()
    await expect(page).not.toHaveURL(/verifications/)
  })

  test('ratée : statut inchangé et nouvel essai annoncé', async ({ page }) => {
    await commencer(page)
    await repondreTout(page, true)

    await expect(page.getByRole('heading', { name: 'Vérification non validée' })).toBeVisible()
    await expect(page.getByText('Statut inchangé')).toBeVisible()
    await page.getByRole('button', { name: 'Retour à Aujourd’hui' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Aujourd’hui' })).toBeVisible()
  })

  test('quitter garde la première partie : on reprend à la suivante', async ({ page }) => {
    await commencer(page)
    await repondre(page, false)
    await expect(page.getByText('✓ Réponse enregistrée')).toBeVisible()

    await page.goto('./#/')
    await page.goto(`./#/verifications/${VERIFICATION_B02}`)

    await expect(
      page.getByRole('list', { name: 'Parties' }).getByRole('listitem').first(),
    ).toContainText('✓')
  })
})
