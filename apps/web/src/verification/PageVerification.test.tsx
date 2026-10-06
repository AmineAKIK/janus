import { ROUTES } from '@janus/contrats'
import { createMemoryHistory } from '@tanstack/react-router'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MANIFESTES_GRAINE } from '../demo/graine.ts'
import { creerRouteur } from '../routes/arbre.tsx'
import { creerContexteTest } from '../routes/contexteTest.tsx'
import { texteIntervalle } from '../revision/textes.ts'
import { texteProchaineEcheance } from './textes.ts'

// Le Web Worker et l'iframe n'existent pas dans jsdom : Playwright teste le vrai exécuteur.
const executions = vi.hoisted(() => ({ reussite: true }))
vi.mock('./executeur.ts', () => ({
  executerCode: (code: string, cas: readonly unknown[]) => {
    const reussis = executions.reussite ? cas.length : 0
    return Promise.resolve({
      code,
      reussis,
      cas: cas.map(() => ({ reussi: executions.reussite, obtenu: 4 })),
    })
  },
}))

async function afficher(
  options: { avant?: (banc: ReturnType<typeof creerContexteTest>) => void } = {},
) {
  const banc = creerContexteTest({ delaiCorrectionMs: 0 })
  options.avant?.(banc)
  const { taches } = await banc.transport.appeler(ROUTES['GET /aujourdhui'], {})
  const lien = taches.find(({ tache }) => tache.type === 'verification')?.lien
  if (lien === undefined) throw new Error('Aucune vérification dans la file')
  const routeur = creerRouteur(createMemoryHistory({ initialEntries: [lien] }), banc.contexte)
  await act(async () => {
    render(banc.application(routeur))
    await routeur.load()
  })
  return { banc, lien }
}

const reponseSolide = (attendu: string) => attendu.split(/\s+/u).reverse().join(' ')

/** Répond à la partie affichée : texte libre ou tâche, selon ce que l'écran montre. */
async function repondre(utilisateur: ReturnType<typeof userEvent.setup>, mal = false) {
  const manifeste = MANIFESTES_GRAINE['B02']
  const consigne = (await screen.findAllByText(/./u, { selector: 'p.texte-sous-titre-18' }))[0]
    ?.textContent
  const differee = manifeste?.differees.find((candidate) => candidate.consigne === consigne)
  if (differee === undefined) throw new Error(`Partie inconnue : ${consigne ?? ''}`)

  if (differee.type === 'tache') {
    const champ =
      screen.queryByRole('textbox', { name: 'Ton code' }) ??
      screen.getByRole('textbox', { name: 'Ta réponse' })
    await utilisateur.type(champ, mal ? 'faux' : differee.attendu)
    await utilisateur.click(screen.getByRole('button', { name: 'Envoyer la tâche' }))
    return
  }
  await utilisateur.click(screen.getByRole('radio', { name: 'Sûr' }))
  const libelle = differee.type === 'explication' ? 'Réponse libre' : 'Écris ta réponse ici'
  await utilisateur.type(
    screen.getByRole('textbox', { name: libelle }),
    reponseSolide(differee.attendu),
  )
  await utilisateur.click(screen.getByRole('button', { name: 'Envoyer' }))
}

describe('Vérification', () => {
  it('annonce le bloc masqué, rassure sur l’anonymat et propose de commencer', async () => {
    await afficher()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Vérification · bloc masqué' }),
    ).toBeVisible()
    expect(screen.getByText('Vérifier ce qui tient dans le temps')).toBeVisible()
    expect(
      screen.getByText(
        'Le bloc restera anonyme jusqu’au résultat. Les corrections seront révélées à la fin.',
      ),
    ).toBeVisible()
    expect(screen.getByText('1 vérification · 3 parties · sans aide')).toBeVisible()
    expect(screen.getByText('Réponds de mémoire, sans ouvrir tes notes.')).toBeVisible()
    expect(document.body.textContent).not.toMatch(/\bB02\b|Logique booléenne/)
  })

  it('montre les trois parties et coche celles qui sont envoyées', async () => {
    const utilisateur = userEvent.setup()
    await afficher()
    await utilisateur.click(await screen.findByRole('button', { name: 'Commencer' }))

    const parties = screen.getByRole('list', { name: 'Parties' })
    expect(
      within(parties)
        .getAllByRole('listitem')
        .map((ligne) => ligne.textContent),
    ).toEqual(['1 Explication', '2 Tâche', '3 Transfert'])

    await repondre(utilisateur)

    await screen.findByText('✓ Réponse enregistrée')
    expect(
      within(screen.getByRole('list', { name: 'Parties' })).getAllByRole('listitem')[0],
    ).toHaveTextContent('✓ Explication')
    expect(screen.queryByText(/Correction simulée/)).toBeNull()
  })

  it('refuse un champ vide et signale un collage', async () => {
    const utilisateur = userEvent.setup()
    await afficher()
    await utilisateur.click(await screen.findByRole('button', { name: 'Commencer' }))
    await utilisateur.click(screen.getByRole('radio', { name: 'Sûr' }))

    await utilisateur.click(screen.getByRole('button', { name: 'Envoyer' }))
    expect(screen.getByText('Ce champ est obligatoire.')).toBeVisible()

    await utilisateur.click(screen.getByRole('textbox', { name: 'Réponse libre' }))
    await utilisateur.paste('Texte collé')
    expect(
      screen.getByText('Tu as collé du texte. Cette réponse ne comptera pas comme preuve.'),
    ).toBeVisible()
  })

  it('réussie : révèle le bloc, son nouveau statut et le prochain retest', async () => {
    const utilisateur = userEvent.setup()
    await afficher()
    await utilisateur.click(await screen.findByRole('button', { name: 'Commencer' }))

    for (let partie = 0; partie < 3; partie += 1) await repondre(utilisateur)

    await screen.findByRole('heading', { name: 'Vérification réussie' })
    expect(screen.getByText('C’était B02 Logique booléenne')).toBeVisible()
    expect(screen.getByText('B02 passe à Acquis')).toBeVisible()
    expect(screen.getByText('La preuve tient dans les trois parties.')).toBeVisible()
    expect(screen.getByText(/^Prochain retest le \d+ \S+$/)).toBeVisible()
    expect(screen.getByRole('button', { name: /^Étape suivante/ })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Retour à Aujourd’hui' })).toBeVisible()
  })

  it('ratée : dit « statut inchangé » et la date du nouvel essai', async () => {
    executions.reussite = false
    const utilisateur = userEvent.setup()
    await afficher()
    await utilisateur.click(await screen.findByRole('button', { name: 'Commencer' }))

    for (let partie = 0; partie < 3; partie += 1) await repondre(utilisateur, true)

    await screen.findByRole('heading', { name: 'Vérification non validée' })
    expect(screen.getByText('Statut inchangé')).toBeVisible()
    expect(screen.getByText(/^Nouvelle vérification le \d+ \S+$/)).toBeVisible()
    executions.reussite = true
  })

  it('chaque partie se déplie pour lire sa correction', async () => {
    const utilisateur = userEvent.setup()
    await afficher()
    await utilisateur.click(await screen.findByRole('button', { name: 'Commencer' }))
    for (let partie = 0; partie < 3; partie += 1) await repondre(utilisateur)
    await screen.findByRole('heading', { name: 'Vérification réussie' })

    await utilisateur.click(screen.getByRole('button', { name: /^Explication/ }))

    expect(screen.getByText(/Correction simulée/)).toBeVisible()
  })

  it('reprend à la partie suivante après un départ', async () => {
    const utilisateur = userEvent.setup()
    const { banc, lien } = await afficher()
    await utilisateur.click(await screen.findByRole('button', { name: 'Commencer' }))
    await repondre(utilisateur)
    await screen.findByText('✓ Réponse enregistrée')
    await waitFor(() => {
      expect(
        banc.magasin.lire().verifications[lien.replace('/verifications/', '')]?.debut,
      ).not.toBeNull()
    })

    banc.client.clear()
    const routeur = creerRouteur(createMemoryHistory({ initialEntries: [lien] }), banc.contexte)
    await act(async () => {
      render(banc.application(routeur))
      await routeur.load()
    })

    expect(await screen.findByRole('button', { name: 'Envoyer la tâche' })).toBeVisible()
  })

  it('un bloc revu récemment propose de reporter ou de continuer', async () => {
    const utilisateur = userEvent.setup()
    const { banc } = await afficher({
      avant: (banc) => {
        banc.magasin.ecrire((etat) => ({
          ...etat,
          faits: [
            ...etat.faits,
            {
              id: 'ouverture',
              bloc: 'B02',
              date: new Date(Date.parse('2026-10-05T10:00:00.000Z') - 1000).toISOString(),
              type: 'bloc_ouvert' as const,
              horsPrerequis: false,
            },
          ],
        }))
      },
    })

    expect(await screen.findByText('Ce bloc a été revu récemment')).toBeVisible()
    expect(
      screen.getByText('Tu as ouvert ce bloc aujourd’hui. Cette vérification ne compterait pas.'),
    ).toBeVisible()
    await utilisateur.click(screen.getByRole('button', { name: 'La reporter à demain' }))

    await waitFor(() => {
      expect(Object.values(banc.magasin.lire().verifications)[0]?.reporteeJusqua).not.toBeNull()
    })
  })
})

describe('textes du résultat', () => {
  it('nomme la prochaine échéance selon son type et l’issue', () => {
    expect(texteProchaineEcheance('reussie', { type: 'retest', apres: '2026-11-04' })).toBe(
      'Prochain retest le 4 nov.',
    )
    expect(texteProchaineEcheance('ratee', { type: 'verification', apres: '2026-10-08' })).toBe(
      'Nouvelle vérification le 8 oct.',
    )
    expect(texteIntervalle(60_000)).toBe('1 min')
  })
})
