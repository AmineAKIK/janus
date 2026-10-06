import { ErreurApi } from '@janus/contrats'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { creerRouteur } from '../routes/arbre.tsx'
import { creerContexteTest } from '../routes/contexteTest.tsx'
import { lignesRegles, texteDuree, texteEchecs, texteEntretien } from './textes.ts'
import { Reglages } from '@janus/contrats'

function simulerBureau(actif: boolean) {
  vi.stubGlobal('matchMedia', (requete: string) => ({
    matches: actif && requete.includes('1024px'),
    media: requete,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
}

async function afficher(chemin: string) {
  const banc = creerContexteTest()
  const routeur = creerRouteur(createMemoryHistory({ initialEntries: [chemin] }), banc.contexte)
  await act(async () => {
    render(banc.application(routeur))
    await routeur.load()
  })
  return banc
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('textes des règles', () => {
  it('écrit les durées, échecs et mois d’entretien à la française', () => {
    expect(texteDuree(60)).toBe('1 h')
    expect(texteDuree(2880)).toBe('2 j')
    expect(texteDuree(90)).toBe('90 min')
    expect(texteEchecs(2)).toBe('Deux échecs pour descendre')
    expect(texteEchecs(1)).toBe('Un échec pour descendre')
    expect(texteEntretien([3, 6, 12])).toBe('3, 6 et 12 mois')
    expect(texteEntretien([6])).toBe('6 mois')
  })

  it('liste les huit règles protégées avec leur valeur par défaut', () => {
    const lignes = lignesRegles(Reglages.parse({}))
    expect(lignes.map(({ libelle, valeur }) => `${libelle} ${valeur}`)).toEqual([
      'Consolidation 1 h',
      'Vérification 3 j',
      'Retest 30 j',
      'Entretien 3, 6 et 12 mois',
      'Nouvelle tentative 2 j',
      'Échecs avant descente Deux échecs pour descendre',
      'Seuil de consolidation 80 %',
      'Revue Tous les 3 blocs',
    ])
  })
})

describe('Paramètres sur mobile', () => {
  it('propose la liste « Choisis une section » puis une route par section', async () => {
    const utilisateur = userEvent.setup()
    await afficher('/parametres')
    const liste = await screen.findByRole('navigation', { name: 'Choisis une section' })
    expect(screen.queryByText('Nouvelles cartes par jour')).toBeNull()

    expect(
      within(liste)
        .getAllByRole('link')
        .map((lien) => lien.textContent),
    ).toEqual(['Révision', 'Règles de la méthode', 'Affichage'])
    expect(screen.getByText(/ne vend pas tes données/)).toBeVisible()
    await utilisateur.click(within(liste).getByRole('link', { name: 'Révision' }))
  })

  it('montre seulement la section demandée, avec un retour', async () => {
    await afficher('/parametres/revision')

    expect(await screen.findByLabelText('Nouvelles cartes par jour')).toHaveValue('20')
    expect(screen.queryByText('Règle protégée')).toBeNull()
    expect(screen.getByRole('link', { name: '← Paramètres' })).toBeVisible()
  })
})

describe('Paramètres sur bureau', () => {
  it('montre l’introduction, le sommaire et toutes les sections', async () => {
    simulerBureau(true)
    await afficher('/parametres')

    expect(await screen.findByText(/jamais les règles de preuve/)).toBeVisible()
    const sommaire = screen.getByRole('navigation', { name: 'Sur cette page' })
    expect(within(sommaire).getAllByRole('link')).toHaveLength(3)
    expect(screen.getByRole('region', { name: 'Révision' })).toBeVisible()
    expect(screen.getByRole('region', { name: 'Règles de la méthode' })).toBeVisible()
    expect(screen.getByText('Règle protégée')).toBeVisible()
    expect(
      screen.getByText(
        'Les délais méthodologiques restent en lecture seule pour préserver la preuve.',
      ),
    ).toBeVisible()
  })
})

describe('Révision', () => {
  it('enregistre à la sortie du champ et propose de revenir au défaut', async () => {
    const utilisateur = userEvent.setup()
    const banc = await afficher('/parametres/revision')
    const champ = await screen.findByLabelText('Questions de début de séance')
    expect(screen.queryByRole('button', { name: 'Revenir à la valeur par défaut' })).toBeNull()

    await utilisateur.clear(champ)
    await utilisateur.type(champ, '8')
    await utilisateur.tab()

    await waitFor(() => {
      expect(banc.magasin.lire().reglages.questionsDebut).toBe(8)
    })
    expect(screen.getByText('Par défaut : 6')).toBeVisible()
    await utilisateur.click(
      await screen.findByRole('button', { name: 'Revenir à la valeur par défaut' }),
    )
    await waitFor(() => {
      expect(banc.magasin.lire().reglages.questionsDebut).toBe(6)
    })
  })

  it('refuse une valeur hors bornes sans l’enregistrer', async () => {
    const utilisateur = userEvent.setup()
    const banc = await afficher('/parametres/revision')
    const champ = await screen.findByLabelText('Questions de début de séance')

    await utilisateur.clear(champ)
    await utilisateur.type(champ, '4')
    await utilisateur.tab()

    expect(
      await screen.findByText(
        'Le nombre de questions de début de séance doit être un entier entre 5 et 10.',
      ),
    ).toBeVisible()
    expect(banc.magasin.lire().reglages.questionsDebut).toBe(6)
  })

  it('accepte la virgule pour la rétention visée', async () => {
    const utilisateur = userEvent.setup()
    const banc = await afficher('/parametres/revision')
    const champ = await screen.findByLabelText('Rétention visée')
    expect(champ).toHaveValue('0,90')

    await utilisateur.clear(champ)
    await utilisateur.type(champ, '0,95')
    await utilisateur.tab()

    await waitFor(() => {
      expect(banc.magasin.lire().reglages.retentionVisee).toBe(0.95)
    })
  })

  it('sur un conflit 412, relit les réglages et prévient', async () => {
    const utilisateur = userEvent.setup()
    const banc = await afficher('/parametres/revision')
    const champ = await screen.findByLabelText('Nouvelles cartes par jour')
    const appeler = banc.transport.appeler.bind(banc.transport)
    banc.transport.appeler = (route: never, entree: never, options: never) =>
      Reflect.get(route, 'methode') === 'PATCH'
        ? Promise.reject(
            new ErreurApi({
              status: 412,
              code: 'conflit',
              titre: 'Conflit',
              detail: 'Les réglages ont changé.',
            }),
          )
        : appeler(route, entree, options)

    await utilisateur.clear(champ)
    await utilisateur.type(champ, '30')
    await utilisateur.tab()

    expect(await screen.findByText('Ces réglages ont changé sur un autre appareil.')).toBeVisible()
  })
})

describe('Règles de la méthode', () => {
  it('sont en lecture seule', async () => {
    await afficher('/parametres/regles')

    expect(await screen.findByText('Règle protégée')).toBeVisible()
    expect(screen.getByText('3, 6 et 12 mois')).toBeVisible()
    expect(screen.queryByRole('textbox')).toBeNull()
  })
})

describe('Affichage', () => {
  it('change l’apparence et la taille du texte', async () => {
    const utilisateur = userEvent.setup()
    await afficher('/parametres/affichage')

    await utilisateur.click(await screen.findByRole('radio', { name: 'Sombre' }))
    await utilisateur.click(screen.getByRole('radio', { name: 'Grand' }))

    expect(document.documentElement.dataset['theme']).toBe('sombre')
    expect(document.documentElement.dataset['taille']).toBe('grand')
  })
})
