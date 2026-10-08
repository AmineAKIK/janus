import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { avancer, remettreAZero } from './banc.ts'
import { acquerirB01, connecter, ORIGINE } from './parcours.ts'

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
const JOUR_MS = 24 * 3_600_000

const reponseSolide = (attendu: string) => attendu.split(/\s+/u).reverse().join(' ')

/** Répond à la partie affichée, comme le ferait Amine. */
async function repondre(page: Page, precedente?: string): Promise<string> {
  const consignes = page.locator('p.texte-sous-titre-18').first()
  if (precedente !== undefined) await expect(consignes).not.toHaveText(precedente)
  const consigne = await consignes.textContent()
  const differee = MANIFESTE.differees.find((partie) => partie.consigne === consigne)
  if (differee === undefined) throw new Error(`Partie inconnue : ${consigne ?? ''}`)

  if (differee.type === 'tache') {
    await page.getByRole('textbox', { name: /^(Ton code|Ta réponse)$/ }).fill(differee.attendu)
    await page.getByRole('button', { name: 'Envoyer la tâche' }).click()
    return consigne ?? ''
  }
  await page.getByRole('radio', { name: 'Sûr' }).click()
  const libelle = differee.type === 'explication' ? 'Réponse libre' : 'Écris ta réponse ici'
  await page.getByRole('textbox', { name: libelle }).fill(reponseSolide(differee.attendu))
  await page.getByRole('button', { name: 'Envoyer', exact: true }).click()
  return consigne ?? ''
}

test.describe('vérification sur l’API réelle', () => {
  test.beforeEach(async ({ request }) => {
    await remettreAZero(request)
  })

  test('B01 acquis, trois jours plus tard la vérification est due : trois parties, puis le bloc révélé', async ({
    page,
    request,
  }) => {
    await connecter(page)
    await acquerirB01(page, request)
    await avancer(request, 3 * JOUR_MS)
    // La session de la veille a expiré : on se reconnecte, puis Aujourd'hui annonce la vérification.
    await connecter(page)
    const aujourdhui = await page.request.get('/api/aujourdhui', { headers: { Origin: ORIGINE } })
    const { taches } = (await aujourdhui.json()) as {
      taches: { tache: { type: string }; lien: string }[]
    }
    const verification = taches.find(({ tache }) => tache.type === 'verification')
    expect(verification).toBeDefined()

    await page.goto(`./#${verification?.lien ?? ''}`)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Vérification · bloc masqué' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Commencer' }).click()
    let precedente: string | undefined
    for (let partie = 0; partie < 3; partie += 1) {
      precedente = await repondre(page, precedente)
    }

    await expect(page.getByRole('heading', { name: 'Vérification réussie' })).toBeVisible()
    await expect(page.getByText('B01 passe à Acquis')).toBeVisible()
  })
})
