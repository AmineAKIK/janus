import { ROUTES } from '@janus/contrats'
import { describe, expect, it, vi } from 'vitest'
import { monterDemo } from './banc.ts'

const ID = (n: number) => `0190a000-0000-7000-8000-${n.toString(16).padStart(12, '0')}`
const ATTENDU = 'Réponse attendue : Que contient une fiche .'

function demande(n: number, surcharge: Record<string, unknown> = {}) {
  return {
    id: ID(n),
    serie: 'restitution' as const,
    tentative: 1,
    question: 'R1',
    reponse: `${ATTENDU} Et voilà mes propres mots pour expliquer.`,
    confiance: 'sur' as const,
    relance: '',
    support: { colle: false, retour_cours: false },
    bloc: 'B08',
    version: 1,
    ...surcharge,
  }
}

describe('POST /corrections de la démo', () => {
  it('corrige avec le correcteur simulé et enregistre un fait qui compte', async () => {
    const { transport, magasin } = monterDemo()

    const correction = await transport.appeler(ROUTES['POST /corrections'], { corps: demande(1) })

    expect(correction).toMatchObject({ niveau: 'solide', compte: true, tour: 1, certitude: 'sur' })
    expect(correction.message.startsWith('Correction simulée (démo) : ')).toBe(true)
    expect(magasin.lire().faits.filter(({ bloc }) => bloc === 'B08')).toHaveLength(1)
  })

  it('refuse une réponse faite d’espaces', async () => {
    const { transport } = monterDemo()

    await expect(
      transport.appeler(ROUTES['POST /corrections'], { corps: demande(1, { reponse: '   ' }) }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('ne compte pas une relance, ni une réponse avec support', async () => {
    const { transport } = monterDemo()

    const relance = await transport.appeler(ROUTES['POST /corrections'], {
      corps: demande(1, { relance: 'Je précise ma réponse.' }),
    })
    const support = await transport.appeler(ROUTES['POST /corrections'], {
      corps: demande(2, { support: { colle: true, retour_cours: false } }),
    })

    expect(relance).toMatchObject({ compte: false, raison_non_compte: 'relance', tour: 2 })
    expect(support).toMatchObject({ compte: false, raison_non_compte: 'avec_support' })
  })

  it('rend les erreurs critiques de la question quand la réponse n’est pas solide', async () => {
    const { transport } = monterDemo()

    const correction = await transport.appeler(ROUTES['POST /corrections'], {
      corps: demande(1, { reponse: 'Je ne sais pas' }),
    })

    expect(correction).toMatchObject({ niveau: 'pas_encore', erreurs_critiques: ['E1'] })
    expect(correction.message).toContain('Indice')
  })

  it('ne ré-enregistre pas une demande déjà reçue', async () => {
    const { transport, magasin } = monterDemo()
    const corps = demande(1)

    const premiere = await transport.appeler(ROUTES['POST /corrections'], { corps })
    const seconde = await transport.appeler(ROUTES['POST /corrections'], { corps })

    expect(seconde).toEqual(premiere)
    expect(magasin.lire().faits.filter(({ bloc }) => bloc === 'B08')).toHaveLength(1)
  })

  it('suit les interrupteurs de démo', async () => {
    const { transport, magasin } = monterDemo()
    const interrupteur = (cle: string) => {
      magasin.ecrire((etat) => ({
        ...etat,
        interrupteurs: { ...etat.interrupteurs, [cle]: true },
      }))
    }

    interrupteur('correctionNonVerifiee')
    const nonVerifiee = await transport.appeler(ROUTES['POST /corrections'], { corps: demande(1) })
    interrupteur('plafondAtteint')
    const plafond = transport.appeler(ROUTES['POST /corrections'], { corps: demande(2) })
    interrupteur('correctionIndisponible')
    const indispo = transport.appeler(ROUTES['POST /corrections'], { corps: demande(3) })

    expect(nonVerifiee).toMatchObject({
      certitude: 'non_verifie',
      compte: false,
      raison_non_compte: 'non_verifiee',
    })
    await expect(plafond).rejects.toMatchObject({ status: 429, code: 'budget_atteint' })
    await expect(indispo).rejects.toMatchObject({ status: 503 })
  })

  it('simule 800 ms de correction par défaut', async () => {
    vi.useFakeTimers()
    try {
      const { transport } = monterDemo({ delaiCorrectionMs: 800 })
      const fini = vi.fn()

      const appel = transport.appeler(ROUTES['POST /corrections'], { corps: demande(1) }).then(fini)
      await vi.advanceTimersByTimeAsync(799)
      expect(fini).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      await appel

      expect(fini).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('répond 404 pour une question inconnue et 501 pour une série pas encore codée', async () => {
    const { transport } = monterDemo()

    await expect(
      transport.appeler(ROUTES['POST /corrections'], { corps: demande(1, { question: 'Z9' }) }),
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      transport.appeler(ROUTES['POST /corrections'], {
        corps: demande(2, { serie: 'rappel', bloc: undefined, version: undefined }),
      }),
    ).rejects.toMatchObject({ status: 501 })
  })

  it('met une correction de premier tour sur dix à l’avis d’Amine : la 1re, la 11e, etc.', async () => {
    const { transport } = monterDemo({ delaiCorrectionMs: 0 })
    const echantillons: boolean[] = []

    for (let n = 1; n <= 12; n++) {
      const correction = await transport.appeler(ROUTES['POST /corrections'], {
        corps: demande(n, { question: n % 2 === 0 ? 'R1' : 'R2' }),
      })
      echantillons.push(correction.echantillon)
    }
    const relance = await transport.appeler(ROUTES['POST /corrections'], {
      corps: demande(13, { relance: 'Je précise.' }),
    })

    expect(echantillons.map((e, i) => (e ? i + 1 : null)).filter((n) => n !== null)).toEqual([
      1, 11,
    ])
    expect(relance.echantillon).toBe(false)
  })

  it('accepte l’avis d’Amine sur une correction connue, refuse une inconnue', async () => {
    const { transport } = monterDemo({ delaiCorrectionMs: 0 })
    await transport.appeler(ROUTES['POST /corrections'], { corps: demande(1) })

    await expect(
      transport.appeler(ROUTES['POST /corrections/:id/accord'], {
        params: { id: ID(1) },
        corps: { accord: false },
      }),
    ).resolves.toBeNull()
    await expect(
      transport.appeler(ROUTES['POST /corrections/:id/accord'], {
        params: { id: ID(99) },
        corps: { accord: true },
      }),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('revenir au cours pendant la restitution : la réponse ne compte pas', async () => {
    const { transport } = monterDemo({ delaiCorrectionMs: 0 })

    const retour = await transport.appeler(ROUTES['POST /corrections'], {
      corps: demande(1, {
        bloc: 'B03',
        question: 'R2',
        support: { colle: false, retour_cours: true },
      }),
    })

    expect(retour).toMatchObject({ compte: false, raison_non_compte: 'avec_support' })
  })
})
