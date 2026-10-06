import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export interface Ecran {
  /** Ce qu'il faut faire une fois l'écran affiché pour atteindre l'état à photographier. */
  readonly scenario?: (page: Page) => Promise<void>
  readonly nom: string
  /** Chemin relatif à la base de l'appli (`./` pour l'accueil, `./#/…` pour les écrans de l'appli). */
  readonly chemin: string
  /** Titre (`h1`) à attendre à l'écran avant de prendre la capture. */
  readonly etat: string
  /** Titre du document (`<title>`) quand il n'est pas celui du `h1`. */
  readonly titre?: string
  /** Faux pour un écran qu'on ouvre sans session. */
  readonly session?: boolean
  /** Interrupteurs de démo à activer avant d'ouvrir l'écran (voir `session.ts`). */
  readonly interrupteurs?: readonly string[]
  /** Boutons à cliquer, dans l'ordre, une fois l'écran affiché (par exemple pour ouvrir un dialogue). */
  readonly clics?: readonly string[]
}

/** Répond à toutes les questions de la série affichée par la fiche, avec des mots à soi. */
async function repondreALaSerie(page: Page) {
  const fiche = page.frameLocator('iframe[title^="Fiche du bloc B03"]')
  const items = fiche.locator('.item')
  const nombre = await items.count()
  for (let rang = 0; rang < nombre; rang++) {
    const item = items.nth(rang)
    const libelle = await item.locator('strong').first().innerText()
    await item
      .locator('textarea')
      .fill(
        `Réponse attendue : ${libelle} . Je l’explique avec mes propres mots, en détail, comme à un camarade.`,
      )
    await item.getByLabel('Sûr').check()
    await item.getByRole('button', { name: 'Envoyer' }).click()
    await expect(item.locator('.correction')).toBeVisible()
  }
}

/** Ouvre le bloc B03 et envoie toute la restitution. */
async function apresRestitution(page: Page) {
  const fiche = page.frameLocator('iframe[title^="Fiche du bloc B03"]')
  await expect(fiche.getByRole('status').filter({ hasText: 'Dans l’appli' })).toBeVisible()
  await fiche.getByRole('button', { name: 'Restitution' }).click()
  await repondreALaSerie(page)
  await fiche.getByRole('button', { name: 'Consolidation' }).click()
}

/** Écrans photographiés à chaque PR, en 4 captures chacun. */
export const ecrans: readonly Ecran[] = [
  { nom: 'vitrine', chemin: './vitrine.html', etat: 'Vitrine' },
  { nom: 'accueil', chemin: './#/', etat: 'Aujourd’hui' },
  {
    nom: 'connexion',
    chemin: './#/connexion',
    etat: 'Atelier',
    titre: 'Connexion',
    session: false,
  },
  { nom: 'questions', chemin: './#/questions', etat: 'Questions de début de séance' },
  { nom: 'formations', chemin: './#/formations', etat: 'Formations' },
  {
    nom: 'formations-deux',
    chemin: './#/formations',
    etat: 'Formations',
    interrupteurs: ['deuxFormations'],
  },
  {
    nom: 'modules',
    chemin: './#/formations/DWWM',
    etat: 'DWWM · Développeur web et web mobile',
    titre: 'Modules',
  },
  { nom: 'blocs', chemin: './#/modules/M1', etat: 'Module 1', titre: 'Blocs' },
  {
    nom: 'blocs-filtre',
    chemin: './#/modules/M1?statut=a_reprendre',
    etat: 'Module 1',
    titre: 'Blocs',
  },
  {
    nom: 'blocs-selection',
    chemin: './#/modules/M1?detail=B04',
    etat: 'Module 1',
    titre: 'Blocs',
  },
  {
    nom: 'blocs-prerequis',
    chemin: './#/modules/M1?detail=B08',
    etat: 'Module 1',
    titre: 'Blocs',
    clics: ['Ouvrir le bloc'],
  },
  {
    nom: 'bloc',
    chemin: './#/blocs/B03',
    etat: 'Ordinateur et composants',
    titre: 'Page de bloc',
  },
  {
    nom: 'bloc-chargement',
    chemin: './#/blocs/B03',
    etat: 'Ordinateur et composants',
    titre: 'Page de bloc',
    interrupteurs: ['reseauLent'],
  },
  {
    nom: 'bloc-refuse',
    chemin: './#/blocs/B03',
    etat: 'Ordinateur et composants',
    titre: 'Page de bloc',
    interrupteurs: ['ficheRefusee'],
  },
  {
    nom: 'bloc-hors-connexion',
    chemin: './#/blocs/B03',
    etat: 'Ordinateur et composants',
    titre: 'Page de bloc',
    scenario: async (page) => {
      const fiche = page.frameLocator('iframe[title^="Fiche du bloc B03"]')
      await expect(fiche.getByRole('status').filter({ hasText: 'Dans l’appli' })).toBeVisible()
      await page.evaluate(() => window.__janusDemo?.interrupteur('horsConnexion', true))
      for (const titre of ['Explication', 'Pratique guidée', 'Restitution']) {
        await fiche.getByRole('button', { name: titre }).click()
      }
      await expect(page.getByText('En attente de réseau · 3 réponses gardées')).toBeVisible()
    },
  },
  {
    nom: 'bloc-revoir-cours',
    chemin: './#/blocs/B03',
    etat: 'Ordinateur et composants',
    titre: 'Page de bloc',
    scenario: async (page) => {
      const fiche = page.frameLocator('iframe[title^="Fiche du bloc B03"]')
      await expect(fiche.getByRole('status').filter({ hasText: 'Dans l’appli' })).toBeVisible()
      await fiche.getByRole('button', { name: 'Restitution' }).click()
      await page
        .getByRole('navigation', { name: 'Étapes de la fiche' })
        .getByRole('button', { name: 'Explication' })
        .click()
      await expect(page.getByRole('dialog', { name: 'Revoir le cours maintenant ?' })).toBeVisible()
    },
  },
  {
    nom: 'bloc-consolidation',
    chemin: './#/blocs/B03',
    etat: 'Ordinateur et composants',
    titre: 'Page de bloc',
    scenario: async (page) => {
      await apresRestitution(page)
      await expect(page.getByText(/Consolidation disponible à/)).toBeVisible()
    },
  },
  {
    nom: 'bloc-bilan',
    chemin: './#/blocs/B03',
    etat: 'Ordinateur et composants',
    titre: 'Page de bloc',
    scenario: async (page) => {
      await apresRestitution(page)
      await page
        .getByRole('navigation', { name: 'Étapes de la fiche' })
        .getByRole('button', { name: 'Bilan' })
        .click()
      await expect(page.getByText(/Statut calculé/)).toBeVisible()
    },
  },
  { nom: 'revision', chemin: './#/revision', etat: 'Révision' },
  { nom: 'verification', chemin: './#/verifications/v1', etat: 'Vérification' },
  { nom: 'tableau-de-bord', chemin: './#/tableau-de-bord', etat: 'Tableau de bord' },
  { nom: 'journal', chemin: './#/journal', etat: 'Journal' },
  { nom: 'parametres', chemin: './#/parametres', etat: 'Paramètres' },
  { nom: 'parametres-section', chemin: './#/parametres/revision', etat: 'Paramètres' },
  { nom: 'fiche-demo', chemin: './fiches/demo/fiche-demo.html', etat: 'Bloc de démonstration' },
  { nom: 'introuvable', chemin: './#/n-existe-pas', etat: 'Cette page n’existe pas' },
]
