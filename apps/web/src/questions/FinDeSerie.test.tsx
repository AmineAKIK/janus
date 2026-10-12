import type { CorrectionRecue } from '@janus/contrats'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FinDeSerie } from './FinDeSerie.tsx'
import type { EtatQuestion } from './useSerie.ts'

const QUESTIONS = [
  { id: 'Q1', question: 'Pourquoi une fiche est-elle un fichier statique ?' },
  { id: 'Q2', question: 'Que fait le serveur pendant la correction ?' },
  { id: 'Q3', question: 'Une question laissée sans réponse' },
]

const correction = (extra: Partial<CorrectionRecue> = {}): CorrectionRecue => ({
  id: '0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a01',
  echantillon: false,
  question: 'Q1',
  tour: 1,
  message: 'Tu as bien identifié la raison principale.',
  niveau: 'solide',
  erreurs_critiques: [],
  source: 'support',
  ref: '',
  certitude: 'sur',
  compte: true,
  ...extra,
})

const corrigee = (
  confiance: 'sur' | 'hesitant',
  extra: Partial<CorrectionRecue> = {},
  bloc: string | null = 'B03',
): EtatQuestion => ({
  phase: 'corrigee',
  confiance,
  reponse: 'Ma réponse',
  bloc,
  correction: correction(extra),
})

afterEach(() => {
  window.history.pushState(null, '', '/')
  vi.restoreAllMocks()
})

describe('fin de la série de questions', () => {
  it('compte les questions faites et laisse de côté celles qui n’ont pas été corrigées', () => {
    render(
      <FinDeSerie
        questions={QUESTIONS}
        etats={[corrigee('sur'), corrigee('hesitant'), { phase: 'saisie' }]}
      />,
    )

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/2 questions/)
    expect(screen.getAllByRole('button', { expanded: false })).toHaveLength(2)
    expect(screen.queryByText(QUESTIONS[2]?.question ?? '')).not.toBeInTheDocument()
  })

  it('ouvre puis referme la correction d’une question', async () => {
    const utilisateur = userEvent.setup()
    render(
      <FinDeSerie questions={QUESTIONS} etats={[corrigee('hesitant'), corrigee('hesitant')]} />,
    )

    const premiere = screen.getAllByRole('button', { expanded: false })[0]
    if (premiere === undefined) throw new Error('ligne absente')
    await utilisateur.click(premiere)
    expect(screen.getByText('Tu as bien identifié la raison principale.')).toBeVisible()

    await utilisateur.click(screen.getAllByRole('button', { expanded: true })[0] ?? premiere)
    expect(screen.queryByText('Tu as bien identifié la raison principale.')).not.toBeInTheDocument()
  })

  it('signale une erreur commise en étant sûr', () => {
    render(
      <FinDeSerie
        questions={QUESTIONS}
        etats={[corrigee('sur', { niveau: 'fragile' }), corrigee('sur')]}
      />,
    )

    expect(screen.getAllByLabelText('Erreur en étant sûr')).toHaveLength(1)
  })

  it('le bouton mène à la tâche suivante du jour, sinon à Aujourd’hui', async () => {
    const utilisateur = userEvent.setup()
    const { rerender } = render(<FinDeSerie questions={QUESTIONS} etats={[corrigee('sur')]} />)

    await utilisateur.click(screen.getByRole('button', { name: 'Étape suivante' }))
    expect(window.location.hash).toBe('#/')

    rerender(
      <FinDeSerie
        questions={QUESTIONS}
        etats={[corrigee('sur')]}
        aujourdhui={{
          jour: '2026-10-12',
          en_retard: false,
          premiere_connexion: false,
          module: null,
          taches: [
            {
              tache: { type: 'questions_debut', nombre: 3 },
              faite: true,
              lien: '/questions',
            },
            {
              tache: { type: 'cartes', dues: 2, nouvelles: 0 },
              faite: false,
              lien: '/revision',
            },
          ],
        }}
      />,
    )
    await utilisateur.click(screen.getByRole('button', { name: /Étape suivante/ }))
    expect(window.location.hash).toBe('#/revision')
  })
})
