import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PartieTache } from './Parties.tsx'
import type { Partie } from './useVerification.ts'

const executions = vi.hoisted(() => ({ lancees: 0 }))
vi.mock('./executeur.ts', () => ({
  executerCode: (code: string, cas: readonly unknown[]) => {
    executions.lancees += 1
    return Promise.resolve({
      code,
      reussis: 1,
      cas: cas.map((_, rang) => ({
        reussi: rang === 0,
        obtenu: 4,
        erreur: rang === 1 ? 'temps_depasse' : undefined,
      })),
    })
  },
}))

const tacheDeCode: Partie = {
  id: 'DT3',
  type: 'tache',
  consigne: 'Écris une fonction double(n).',
  tache: {
    mode: 'code',
    langage: 'js',
    cas: [
      { entree: [2], sortie: 4 },
      { entree: [0], sortie: 0 },
    ],
  },
  envoyee: false,
}

describe('PartieTache', () => {
  it('teste les cas, montre chaque résultat et compte deux essais au plus', async () => {
    const utilisateur = userEvent.setup()
    render(
      <PartieTache
        partie={tacheDeCode}
        enAttente={false}
        indisponible={false}
        envoyer={() => undefined}
      />,
    )
    await utilisateur.type(
      screen.getByRole('textbox', { name: 'Ton code' }),
      'function double(n) {{}',
    )
    expect(screen.getByText('Essai 1 sur 2')).toBeVisible()

    await utilisateur.click(screen.getByRole('button', { name: 'Tester les cas' }))
    await screen.findByText('4 ✓')
    expect(screen.getByText('✗ temps dépassé')).toBeVisible()
    await utilisateur.click(screen.getByRole('button', { name: 'Tester les cas' }))

    expect(screen.getByText('Essai 2 sur 2')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Tester les cas' })).toBeDisabled()
  })

  it('envoie le code avec le résultat du test', async () => {
    const utilisateur = userEvent.setup()
    const envoyer = vi.fn()
    render(
      <PartieTache partie={tacheDeCode} enAttente={false} indisponible={false} envoyer={envoyer} />,
    )
    await utilisateur.type(screen.getByRole('textbox', { name: 'Ton code' }), 'x')

    await utilisateur.click(screen.getByRole('button', { name: 'Envoyer la tâche' }))

    expect(envoyer).toHaveBeenCalledWith({
      reponse: 'x',
      confiance: 'hesitant',
      colle: false,
      code: { reussis: 1, total: 2 },
    })
  })

  it('refuse d’envoyer un champ vide', async () => {
    const utilisateur = userEvent.setup()
    const envoyer = vi.fn()
    render(
      <PartieTache partie={tacheDeCode} enAttente={false} indisponible={false} envoyer={envoyer} />,
    )

    await utilisateur.click(screen.getByRole('button', { name: 'Envoyer la tâche' }))

    expect(screen.getByText('Ce champ est obligatoire.')).toBeVisible()
    expect(envoyer).not.toHaveBeenCalled()
  })

  it('une tâche exacte n’a ni éditeur ni essais', () => {
    render(
      <PartieTache
        partie={{ ...tacheDeCode, tache: { mode: 'exacte' } }}
        enAttente={false}
        indisponible={false}
        envoyer={() => undefined}
      />,
    )

    expect(screen.getByRole('textbox', { name: 'Ta réponse' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Tester les cas' })).toBeNull()
    expect(screen.queryByText(/Essai/)).toBeNull()
  })
})
