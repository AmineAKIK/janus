import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import type { APIRequestContext, FrameLocator, Page } from '@playwright/test'
import { allerEtape, ficheALaHauteur, ficheDuBloc, ouvrirSession } from '../e2e/session.ts'

// Les vraies fiches du dépôt (`contenu/<formation>/fiches/<bloc>.html`), jouées dans l'appli contre
// l'API réelle : le banc de la CI les importe après la graine (`apps/api/src/banc/graine.ts`). Tout ce
// qu'un apprenant fait passe par l'écran (séries, bilan, Recommencer, vérifications) ; ce que la fiche
// envoie d'elle-même après un outil (pratique, aisance) part comme elle l'enverrait, par `/api/evenements`.

export interface Question {
  readonly id: string
  readonly question: string
  readonly attendu: string
  readonly erreurs?: readonly string[]
}
export interface Explication extends Question {
  /** L'item de pratique que l'explication conclut. */
  readonly item: string
}
export interface Differee {
  readonly id: string
  readonly type: 'explication' | 'tache' | 'transfert'
  readonly consigne: string
  readonly attendu: string
}
export interface Manifeste {
  readonly bloc: string
  readonly version: number
  readonly titre: string
  readonly prerequis: readonly string[]
  readonly etapes: readonly { readonly id: string; readonly titre: string; readonly type: string }[]
  readonly erreurs_critiques: readonly { readonly id: string; readonly libelle: string }[]
  readonly restitution: readonly Question[]
  readonly pratique: readonly { readonly id: string; readonly items: readonly { id: string }[] }[]
  /** Les explications que l'IA juge : l'item qui en déclare une ne compte qu'avec elle Solide. */
  readonly explication?: readonly Explication[]
  readonly atelier?: { readonly id: string }
  readonly aisance?: { readonly paliers_s: readonly number[] }
  readonly differees: readonly Differee[]
}

export const ORIGINE = 'http://localhost:4173'
export const JOUR_MS = 24 * 3_600_000
/** Ce que le correcteur simulé note « pas encore ». */
export const REPONSE_FAUSSE = 'Je ne sais pas'
/** Une réponse que le correcteur simulé note « solide » : les mots de l'attendu, dans un autre ordre. */
export const reponseSolide = (attendu: string) => attendu.split(/\s+/u).reverse().join(' ')

const CONTENU = fileURLToPath(new URL('../../../contenu/', import.meta.url))

function manifesteDe(html: string, nom: string): Manifeste {
  const texte = /<script\b[^>]*\bid="bloc-manifest"[^>]*>([\s\S]*?)<\/script>/u.exec(html)?.[1]
  if (texte === undefined) throw new Error(`${nom} : pas de manifeste.`)
  return JSON.parse(texte) as Manifeste
}

/** Les manifestes de toutes les fiches du dépôt, par formation puis par nom de fichier. */
export function fichesDuDepot(): readonly Manifeste[] {
  return readdirSync(CONTENU, { withFileTypes: true })
    .filter((entree) => entree.isDirectory())
    .map((entree) => entree.name)
    .sort()
    .flatMap((formation) => {
      const dossier = join(CONTENU, formation, 'fiches')
      let noms: string[]
      try {
        noms = readdirSync(dossier).filter((nom) => nom.endsWith('.html'))
      } catch {
        return []
      }
      return noms
        .sort()
        .map((nom) => manifesteDe(readFileSync(join(dossier, nom), 'utf8'), `${formation}/${nom}`))
    })
}

/** Le titre de la première étape d'un type dans le manifeste. */
export function etapeDuType(manifeste: Manifeste, type: string): string {
  const etape = manifeste.etapes.find((e) => e.type === type)
  if (etape === undefined) throw new Error(`${manifeste.bloc} : pas d’étape « ${type} ».`)
  return etape.titre
}

// --- Le serveur ------------------------------------------------------------

export interface Manque {
  readonly code: string
  readonly apres?: string
  readonly erreurs?: readonly string[]
}
export interface Detail {
  readonly statut: string
  readonly manque: readonly Manque[]
  readonly erreurs_ouvertes: readonly string[]
  readonly avancement: { readonly etapes_vues: readonly string[] }
  readonly serie_ouverte: { readonly restitution: boolean }
  readonly acces: string
  readonly version: number
  readonly aisance_reussies: readonly { readonly le: string; readonly duree_s: number }[]
  readonly etat_page: { readonly version: number; readonly etat: Record<string, unknown> } | null
  readonly preuves: {
    readonly comprendre: string | null
    readonly faire_seul: string | null
    readonly transferer: string | null
    readonly retenir: { readonly date: string | null; readonly prochaine: string | null }
    readonly aisance: string | null
  }
}

/** Ce que le serveur dit du bloc, tel que l'appli le lit. */
export async function detailDuBloc(request: APIRequestContext, bloc: string): Promise<Detail> {
  const reponse = await request.get(`/api/blocs/${bloc}`, { headers: { Origin: ORIGINE } })
  expect(reponse.ok(), `GET /api/blocs/${bloc} : ${String(reponse.status())}`).toBe(true)
  return (await reponse.json()) as Detail
}

/**
 * La fiche groupe ses sauvegardes : on attend que l'état de la page soit au serveur avant de quitter la
 * page, comme un apprenant qui ne ferme pas l'onglet dans la seconde. `pret` dit ce que l'état doit porter.
 */
export async function attendreEtatSauve(
  request: APIRequestContext,
  bloc: string,
  pret: (etat: Record<string, unknown>) => boolean,
) {
  let vu: Detail['etat_page'] = null
  try {
    await expect
      .poll(
        async () => {
          vu = (await detailDuBloc(request, bloc)).etat_page
          return pret(vu?.etat ?? {})
        },
        { timeout: 15_000 },
      )
      .toBe(true)
  } catch (cause) {
    // Rouge, l'erreur dit ce que le serveur garde : sans lui, on devine.
    throw new Error(`État de la page de ${bloc} au serveur : ${JSON.stringify(vu)}`, { cause })
  }
}

let numero = 0
/** Un identifiant d'événement, distinct à chaque appel de la suite. */
export const nouvelId = () =>
  `0190a000-0000-7000-8000-${(numero += 1).toString(16).padStart(12, '0')}`

/** Envoie un message de la page comme la fiche l'enverrait (après un outil, un chrono…). */
export async function envoyerMessage(
  request: APIRequestContext,
  manifeste: Manifeste,
  corps: Record<string, unknown>,
) {
  const reponse = await request.post('/api/evenements', {
    headers: { Origin: ORIGINE },
    data: {
      bloc: manifeste.bloc,
      version: manifeste.version,
      t: '2026-06-01T10:00:00Z',
      id: nouvelId(),
      ...corps,
    },
  })
  expect(reponse.ok(), `${String(corps['type'])} : ${await reponse.text()}`).toBe(true)
}

/**
 * La pratique réussie sans aide, item par item, et l'atelier s'il y en a un. Un item qui déclare une
 * explication l'envoie aussi, comme la fiche après la réussite, et le correcteur simulé la juge Solide.
 */
export async function reussirLaPratique(request: APIRequestContext, manifeste: Manifeste) {
  for (const exercice of manifeste.pratique) {
    for (const item of exercice.items) {
      await envoyerMessage(request, manifeste, {
        type: 'pratique.resultat',
        exercice: exercice.id,
        item: item.id,
        reussi: true,
        aide: 0,
        essais: 1,
      })
    }
  }
  for (const explication of manifeste.explication ?? []) {
    if (explication.id !== explication.item) continue
    const reponse = await request.post('/api/corrections', {
      headers: { Origin: ORIGINE },
      data: {
        id: nouvelId(),
        serie: 'explication',
        tentative: 1,
        question: explication.id,
        reponse: reponseSolide(explication.attendu),
        confiance: 'sur',
        relance: '',
        support: { colle: false, retour_cours: false },
        bloc: manifeste.bloc,
        version: manifeste.version,
      },
    })
    expect(reponse.ok(), `explication ${explication.id} : ${await reponse.text()}`).toBe(true)
  }
  if (manifeste.atelier !== undefined) {
    await envoyerMessage(request, manifeste, {
      type: 'atelier.resultat',
      reussi: true,
      predictions_justes: 3,
      aide: 0,
    })
  }
}

/** Une série d'aisance réussie dans le temps d'un palier, à la seconde près. */
export const reussirLaVitesse = (
  request: APIRequestContext,
  manifeste: Manifeste,
  dureeS: number,
) => envoyerMessage(request, manifeste, { type: 'aisance.resultat', reussi: true, duree_s: dureeS })

/** Force le statut d'un bloc, comme Amine le ferait pour un prérequis qu'il tient pour acquis. */
export async function forcerAcquis(request: APIRequestContext, bloc: string) {
  const reponse = await request.post(`/api/blocs/${bloc}/forcer`, {
    headers: { Origin: ORIGINE },
    data: { action: 'forcer', id: nouvelId(), statut: 'acquis', raison: 'Prérequis du parcours' },
  })
  expect(reponse.ok(), `forcer ${bloc} : ${await reponse.text()}`).toBe(true)
}

// --- L'écran ---------------------------------------------------------------

/**
 * Attend que la vraie fiche ait pris le mode appli et la hauteur de son contenu. Dans l'appli, le
 * gabarit cache sa barre (le fil est celui de la page) : son mode se lit sans être visible.
 */
export async function attendreFiche(page: Page, bloc: string): Promise<FrameLocator> {
  const fiche = ficheDuBloc(page, bloc)
  await expect(fiche.locator('#mode')).toHaveText('Dans l’appli', { timeout: 20_000 })
  await ficheALaHauteur(page, bloc)
  return fiche
}

/** Ouvre la page du bloc dans l'appli, relue au serveur, et rend sa fiche. */
export async function ouvrirLeBloc(page: Page, bloc: string): Promise<FrameLocator> {
  await page.goto(`./#/blocs/${bloc}`)
  // Un changement d'adresse à ancre ne recharge pas la page : on relit l'état du bloc au serveur.
  await page.reload()
  return attendreFiche(page, bloc)
}

/** Ouvre le bloc sur l'étape de ce titre. */
export async function ouvrirEtape(page: Page, bloc: string, etape: string): Promise<FrameLocator> {
  const fiche = await ouvrirLeBloc(page, bloc)
  await allerEtape(page, etape)
  return fiche
}

/**
 * Joue la restitution comme l'apprenant : « Commencer », puis une question à la fois, chacune avec
 * la réponse que `reponse` donne pour elle (solide par défaut). `reprise` : une erreur critique est
 * ouverte, la fiche relit les dernières réponses à reprendre et ne repose que `aPoser`, les questions
 * qui la touchent, marquées « À reprendre », jusqu'à ce qu'une réponse solide la referme. Finit sur
 * « Restitution terminée ».
 */
export async function jouerLaRestitution(
  page: Page,
  manifeste: Manifeste,
  options: {
    readonly reponse?: (question: Question) => string
    readonly reprise?: { readonly aPoser: readonly Question[]; readonly libelle: string }
  } = {},
) {
  const fiche = await ouvrirEtape(page, manifeste.bloc, etapeDuType(manifeste, 'restitution'))
  const aPoser = options.reprise?.aPoser ?? manifeste.restitution
  const reponse = options.reponse ?? ((question: Question) => reponseSolide(question.attendu))
  if (options.reprise !== undefined) {
    await expect(
      fiche.getByRole('heading', { name: 'Tes dernières réponses à reprendre' }),
    ).toBeVisible()
  }
  await fiche.getByRole('button', { name: 'Commencer' }).click()
  for (let rang = 0; rang < aPoser.length; rang += 1) {
    const active = fiche.locator('.item').filter({ has: fiche.locator('textarea:enabled') })
    await expect(active).toHaveCount(1)
    const libelle = await active.locator('label strong').first().innerText()
    const question = aPoser.find((q) => q.question === libelle)
    if (question === undefined) throw new Error(`Question inconnue : ${libelle}`)
    // Envoyée, la question fige sa zone de réponse : on la retient par son texte, pas par son état.
    const item = fiche.locator('.item').filter({ has: fiche.locator('textarea'), hasText: libelle })
    if (options.reprise !== undefined) {
      await expect(item.locator('.item-reprise')).toContainText(
        `À reprendre : ${options.reprise.libelle}`,
      )
    }
    await item.locator('textarea').fill(reponse(question))
    await item.getByLabel('Sûr').check()
    await item.getByRole('button', { name: 'Envoyer', exact: true }).click()
    // La question suivante n'arrive qu'avec la correction de celle-ci ; la dernière réponse redessine la
    // série avec ses corrections. En reprise, la série se referme dès qu'une réponse solide a refermé
    // l'erreur, avant la dernière question : on attend la suite, une autre question ou la fin, pas
    // « Envoyée. » (la zone envoyée met un instant à se figer : elle ne compte pas comme suivante).
    const terminee = fiche.getByText(/^Restitution terminée/)
    const suivante = active.filter({ hasNotText: libelle })
    await expect
      .poll(async () => (await terminee.isVisible()) || (await suivante.count()) === 1, {
        timeout: 15_000,
      })
      .toBe(true)
    if (await terminee.isVisible()) break
  }
  await expect(fiche.getByText(/^Restitution terminée/)).toBeVisible({ timeout: 15_000 })
  await attendreEtatSauve(page.request, manifeste.bloc, (etat) => {
    const envoyees = etat['envoyees']
    return (
      typeof envoyees === 'object' &&
      envoyees !== null &&
      aPoser.every((question) => question.id in envoyees)
    )
  })
  return fiche
}

/** Coche des erreurs critiques dans le bilan et l'envoie. */
export async function envoyerLeBilan(page: Page, manifeste: Manifeste, erreurs: readonly string[]) {
  const fiche = await ouvrirEtape(page, manifeste.bloc, etapeDuType(manifeste, 'bilan'))
  for (const erreur of erreurs) {
    await fiche.locator(`input[name="erreur"][value="${erreur}"]`).check()
  }
  await fiche.getByRole('button', { name: 'Envoyer le bilan' }).click()
  await attendreEtatSauve(page.request, manifeste.bloc, (etat) => etat['bilan'] !== undefined)
  return fiche
}

/** « Recommencer la fiche », confirmé. */
export async function recommencerLaFiche(page: Page, bloc: string) {
  await ouvrirLeBloc(page, bloc)
  await page.getByRole('button', { name: 'Recommencer la fiche' }).click()
  const dialogue = page.getByRole('dialog', { name: 'Recommencer la fiche ?' })
  await dialogue.getByRole('button', { name: 'Recommencer' }).click()
  await expect(dialogue).toHaveCount(0)
  await attendreFiche(page, bloc)
  // Le serveur a reçu l'état vide. La fiche rechargée sauve aussitôt son état de départ (première
  // étape, rien d'envoyé) : on attend un état sans réponses ni bilan, pas un état vide.
  await attendreEtatSauve(
    page.request,
    bloc,
    (etat) =>
      etat['bilan'] === undefined &&
      Object.keys((etat['envoyees'] as Record<string, unknown> | undefined) ?? {}).length === 0,
  )
}

// --- Les vérifications -----------------------------------------------------

/** Le lien de la tâche du jour d'une vérification ou d'un retest de ce bloc. */
export async function lienDeLaVerification(
  request: APIRequestContext,
  bloc: string,
  type: 'verification' | 'retest',
): Promise<string> {
  const aujourdhui = await request.get('/api/aujourdhui', { headers: { Origin: ORIGINE } })
  const { taches } = (await aujourdhui.json()) as {
    taches: { tache: { type: string; bloc?: string }; lien: string }[]
  }
  const tache = taches.find((t) => t.tache.type === type && t.tache.bloc === bloc)
  expect(tache, `Aujourd’hui n’annonce pas de ${type} pour ${bloc}`).toBeDefined()
  return tache?.lien ?? ''
}

/** Répond à la partie affichée, bien ou mal, comme le ferait Amine. */
async function repondreALaPartie(
  page: Page,
  manifeste: Manifeste,
  mal: boolean,
  precedente?: string,
): Promise<string> {
  const consignes = page.locator('p.texte-sous-titre-18').first()
  if (precedente !== undefined) await expect(consignes).not.toHaveText(precedente)
  const consigne = await consignes.textContent()
  const differee = manifeste.differees.find((partie) => partie.consigne === consigne)
  if (differee === undefined) throw new Error(`Partie inconnue : ${consigne ?? ''}`)

  if (differee.type === 'tache') {
    await page
      .getByRole('textbox', { name: /^(Ton code|Ta réponse)$/ })
      .fill(mal ? 'faux' : differee.attendu)
    await page.getByRole('button', { name: 'Envoyer la tâche' }).click()
    return consigne ?? ''
  }
  await page.getByRole('radio', { name: 'Sûr' }).click()
  const libelle = differee.type === 'explication' ? 'Réponse libre' : 'Écris ta réponse ici'
  await page
    .getByRole('textbox', { name: libelle })
    .fill(mal ? REPONSE_FAUSSE : reponseSolide(differee.attendu))
  await page.getByRole('button', { name: 'Envoyer', exact: true }).click()
  return consigne ?? ''
}

/** Les types de parties qu'une vérification de ce bloc tire : un de chaque type que ses différées couvrent. */
export const partiesDe = (manifeste: Manifeste) =>
  (['explication', 'tache', 'transfert'] as const).filter((type) =>
    manifeste.differees.some((differee) => differee.type === type),
  )

/**
 * Fait la vérification (ou le retest) due aujourd'hui depuis la séance du jour, toutes les parties
 * bien ou mal, et attend l'écran du résultat.
 */
export async function faireLaVerification(
  page: Page,
  manifeste: Manifeste,
  type: 'verification' | 'retest',
  mal: boolean,
) {
  const lien = await lienDeLaVerification(page.request, manifeste.bloc, type)
  await page.goto(`./#${lien}`)
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: type === 'verification' ? 'Vérification · bloc masqué' : 'Retest · bloc masqué',
    }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Commencer' }).click()
  let precedente: string | undefined
  for (let partie = 0; partie < partiesDe(manifeste).length; partie += 1) {
    precedente = await repondreALaPartie(page, manifeste, mal, precedente)
  }
  await expect(
    page.getByRole('heading', { name: mal ? 'Vérification non validée' : 'Vérification réussie' }),
  ).toBeVisible({ timeout: 15_000 })
}

/** Fait passer `jours` jours au serveur, puis rouvre une session : celle d'avant a expiré. */
export async function lendemain(page: Page, request: APIRequestContext, jours = 1) {
  const reponse = await request.post('/api/banc/horloge', {
    headers: { Origin: ORIGINE },
    data: { ms: jours * JOUR_MS },
  })
  expect(reponse.ok()).toBe(true)
  await ouvrirSession(page)
}
