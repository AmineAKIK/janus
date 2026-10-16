import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Avancement } from '@janus/contrats'
import { describe, expect, it, vi } from 'vitest'
import { etapesARevoir, etapesFaites, FilEtapes } from './FilEtapes.tsx'

const ETAPES = [
  { id: 'ET1', titre: 'Carte', type: 'carte' as const },
  { id: 'ETP', titre: 'Perception', type: 'perception' as const },
  { id: 'ET2', titre: 'Pré-test', type: 'pretest' as const },
  { id: 'ET3', titre: 'Explication', type: 'explication' as const },
  { id: 'ET4', titre: 'Pratique', type: 'pratique' as const },
  { id: 'ET5', titre: 'Aisance', type: 'aisance' as const },
  { id: 'ETE', titre: 'L’ensemble', type: 'ensemble' as const },
  { id: 'ET6', titre: 'Restitution', type: 'restitution' as const },
  { id: 'ET7', titre: 'Consolidation', type: 'consolidation' as const },
  { id: 'ET8', titre: 'Bilan', type: 'bilan' as const },
]

const RIEN: Avancement = {
  etapes_vues: [],
  restitution: null,
  consolidation: null,
  pratique: null,
  atelier: null,
  aisance: null,
}
const DATE = '2026-06-01T10:30:00Z'

describe('etapesFaites', () => {
  it('n’en compte aucune sans fait, même quand une étape lointaine est affichée', () => {
    expect(etapesFaites(ETAPES, RIEN, ['ET8'], false)).toEqual(new Set())
  })

  it('compte une étape de cours quand elle a été affichée, jamais celles qui la précèdent', () => {
    expect(etapesFaites(ETAPES, RIEN, ['ET3'], false)).toEqual(new Set(['ET3']))
    expect(etapesFaites(ETAPES, { ...RIEN, etapes_vues: ['ET1'] }, ['ET3'], false)).toEqual(
      new Set(['ET1', 'ET3']),
    )
    expect(etapesFaites(ETAPES, RIEN, ['ETP', 'ETE'], false)).toEqual(new Set(['ETP', 'ETE']))
  })

  it('compte une étape à preuve seulement quand le serveur date sa preuve', () => {
    expect(etapesFaites(ETAPES, RIEN, ['ET4', 'ET5', 'ET6', 'ET7'], false)).toEqual(new Set())
    expect(
      etapesFaites(
        ETAPES,
        { ...RIEN, pratique: DATE, aisance: DATE, restitution: DATE, consolidation: DATE },
        [],
        false,
      ),
    ).toEqual(new Set(['ET4', 'ET5', 'ET6', 'ET7']))
  })

  it('compte le bilan quand il a été envoyé', () => {
    expect(etapesFaites(ETAPES, RIEN, [], true)).toEqual(new Set(['ET8']))
  })

  it('ignore une étape inconnue', () => {
    expect(etapesFaites(ETAPES, { ...RIEN, etapes_vues: ['ZZ'] }, ['YY'], false)).toEqual(new Set())
  })
})

describe('etapesARevoir', () => {
  const ERREURS = [
    { id: 'E1', libelle: 'Une', etape: 'ET3' },
    { id: 'E2', libelle: 'Deux' },
    { id: 'E3', libelle: 'Trois', etape: 'ZZ' },
  ]

  it('marque l’étape liée à une erreur ouverte, plus rien une fois l’erreur refermée', () => {
    expect(etapesARevoir(ETAPES, ERREURS, ['E1'], RIEN, false)).toEqual(new Set(['ET3']))
    expect(etapesARevoir(ETAPES, ERREURS, [], RIEN, false)).toEqual(new Set())
  })

  it('ignore une erreur sans étape, ou liée à une étape que la fiche n’a pas', () => {
    expect(etapesARevoir(ETAPES, ERREURS, ['E2', 'E3'], RIEN, false)).toEqual(new Set())
  })

  it('marque la restitution envoyée puis rouverte, jamais celle qui n’a pas encore été envoyée', () => {
    const envoyee = { ...RIEN, restitution: DATE }
    expect(etapesARevoir(ETAPES, ERREURS, [], envoyee, true)).toEqual(new Set(['ET6']))
    expect(etapesARevoir(ETAPES, ERREURS, [], RIEN, true)).toEqual(new Set())
    expect(etapesARevoir(ETAPES, ERREURS, [], envoyee, false)).toEqual(new Set())
  })
})

describe('FilEtapes', () => {
  it('liste un onglet par étape, dans l’ordre, la première est courante par défaut', () => {
    render(
      <FilEtapes
        etapes={ETAPES.slice(0, 4)}
        courante={null}
        avancement={RIEN}
        vues={[]}
        bilanFait={false}
        surChoix={() => undefined}
      />,
    )

    const onglets = within(screen.getByRole('list', { name: 'Étapes' })).getAllByRole('button')
    expect(onglets.map((onglet) => onglet.textContent)).toEqual([
      'Carte',
      'Perception',
      'Pré-test',
      'Explication',
    ])
    expect(onglets[0]).toHaveAttribute('aria-current', 'step')
    expect(onglets[1]).not.toHaveAttribute('aria-current')
  })

  it('préfixe les étapes faites par « ✓ » et marque la courante', () => {
    render(
      <FilEtapes
        etapes={ETAPES}
        courante="ET3"
        avancement={{ ...RIEN, etapes_vues: ['ET1'], pratique: DATE }}
        vues={['ET2', 'ET3']}
        bilanFait={false}
        surChoix={() => undefined}
      />,
    )

    expect(screen.getByRole('button', { name: 'Carte' }).textContent).toBe('✓ Carte')
    expect(screen.getByRole('button', { name: 'Pré-test' }).textContent).toBe('✓ Pré-test')
    expect(screen.getByRole('button', { name: 'Pratique' }).textContent).toBe('✓ Pratique')
    expect(screen.getByRole('button', { name: 'Restitution' }).textContent).toBe('Restitution')
    expect(screen.getByRole('button', { name: 'Explication' })).toHaveAttribute(
      'aria-current',
      'step',
    )
    expect(screen.getByRole('button', { name: 'Explication' }).textContent).toBe('✓ Explication')
  })

  it('marque « ↺ » une étape à revoir, même faite, et l’explique au survol', () => {
    render(
      <FilEtapes
        etapes={ETAPES}
        courante="ET1"
        avancement={{ ...RIEN, etapes_vues: ['ET3'], restitution: DATE }}
        vues={[]}
        bilanFait={false}
        surChoix={() => undefined}
        aRevoir={new Set(['ET3', 'ET6'])}
      />,
    )

    const explication = screen.getByRole('button', { name: 'Explication' })
    expect(explication.textContent).toBe('↺ Explication')
    expect(explication).toHaveAttribute('title', 'À revoir')
    expect(screen.getByRole('button', { name: 'Restitution' }).textContent).toBe('↺ Restitution')
    expect(screen.getByRole('button', { name: 'Carte' })).not.toHaveAttribute('title')
  })

  it('nomme le moment de l’étape courante et compte les étapes dans ce moment', () => {
    render(
      <FilEtapes
        etapes={ETAPES}
        courante="ET3"
        avancement={RIEN}
        vues={[]}
        bilanFait={false}
        surChoix={() => undefined}
      />,
    )

    // Comprendre : pré-test, explication ; l'explication est la deuxième.
    expect(
      screen.getByRole('button', { name: 'Explication · Comprendre · étape 2 sur 2' }),
    ).toBeInTheDocument()
    const moments = within(screen.getByRole('list', { name: 'Moments' })).getAllByRole('listitem')
    expect(moments.map((moment) => moment.textContent)).toEqual([
      'Découvrir',
      'Comprendre',
      'S’entraîner',
      'Prouver',
    ])
    expect(moments[1]).toHaveAttribute('aria-current', 'step')
    expect(moments[0]).not.toHaveAttribute('aria-current')
  })

  it('coche un moment quand toutes ses étapes sont faites, pas avant', () => {
    render(
      <FilEtapes
        etapes={ETAPES}
        courante="ET4"
        avancement={{ ...RIEN, etapes_vues: ['ET1', 'ETP', 'ET2'] }}
        vues={['ET3', 'ETE']}
        bilanFait={false}
        surChoix={() => undefined}
      />,
    )

    // S'entraîner : l'ensemble est vu, mais pas la pratique ni l'aisance.
    const moments = within(screen.getByRole('list', { name: 'Moments' })).getAllByRole('listitem')
    expect(moments.map((moment) => moment.textContent)).toEqual([
      '✓ Découvrir',
      '✓ Comprendre',
      'S’entraîner',
      'Prouver',
    ])
    expect(moments[2]).toHaveAttribute('aria-current', 'step')
    expect(
      screen.getByRole('button', { name: 'Pratique · S’entraîner · étape 1 sur 3' }),
    ).toBeInTheDocument()
  })

  it('demande l’étape cliquée', async () => {
    const choix = vi.fn()
    render(
      <FilEtapes
        etapes={ETAPES}
        courante={null}
        avancement={RIEN}
        vues={[]}
        bilanFait={false}
        surChoix={choix}
      />,
    )

    await userEvent.setup().click(screen.getByRole('button', { name: 'Pratique' }))

    expect(choix).toHaveBeenCalledWith('ET4')
  })
})
