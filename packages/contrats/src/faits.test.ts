import { describe, expect, it } from 'vitest'
import { Fait, ReponseVerification } from './faits.ts'

const commun = { id: 'f1', bloc: 'D01', date: '2026-06-01T10:00:00Z' }

const VALIDES: Record<string, unknown> = {
  bloc_ouvert: { ...commun, type: 'bloc_ouvert', horsPrerequis: true, raison: 'Je connais déjà.' },
  etape_vue: { ...commun, type: 'etape_vue', etape: 'ET1' },
  pratique_resultat: {
    ...commun,
    type: 'pratique_resultat',
    exercice: 'PR1',
    item: 'PR1-1',
    reussi: true,
    aide: 0,
  },
  atelier_resultat: { ...commun, type: 'atelier_resultat', reussi: true, aide: 2 },
  aisance_resultat: { ...commun, type: 'aisance_resultat', reussi: true, dureeS: 12.5 },
  correction: {
    ...commun,
    type: 'correction',
    serie: 'consolidation',
    question: 'C1',
    tour: 1,
    niveau: 'solide',
    compte: false,
    raisonNonCompte: 'recopiee',
    confiance: 'sur',
    erreursIa: ['E1'],
  },
  correction_contestee: { ...commun, type: 'correction_contestee', correction: 'c1' },
  correction_tranchee: {
    ...commun,
    type: 'correction_tranchee',
    correction: 'c1',
    compte: true,
  },
  erreur_ia_tranchee: {
    ...commun,
    type: 'erreur_ia_tranchee',
    correction: 'c1',
    erreur: 'E1',
    decision: 'rejetee',
  },
  verification_terminee: {
    ...commun,
    type: 'verification_terminee',
    verification: 'retest',
    valable: false,
    raisonInvalide: 'revu_avant',
    reponses: [
      { type: 'explication', question: 'DE1', tour: 1, compte: true, niveau: 'solide' },
      { type: 'tache', question: 'DT1', tour: 1, compte: true, reussi: true },
      { type: 'transfert', question: 'DR1', tour: 1, compte: true },
    ],
  },
  erreur_cochee: { ...commun, type: 'erreur_cochee', erreur: 'E1', source: 'amine' },
  erreur_decochee: { ...commun, type: 'erreur_decochee', erreur: 'E1', source: 'ia_confirmee' },
  statut_force: { ...commun, type: 'statut_force', statut: 'maitrise', raison: 'Déjà connu.' },
  force_levee: { ...commun, type: 'force_levee' },
}

describe('Fait', () => {
  it.each(Object.entries(VALIDES))('accepte un fait %s', (_, fait) => {
    expect(Fait.safeParse(fait).success).toBe(true)
  })

  it('couvre les quatorze types de fait', () => {
    expect(Object.keys(VALIDES)).toHaveLength(14)
  })

  it.each([
    ['un type inconnu', { ...commun, type: 'autre' }],
    ['un champ en trop', { ...commun, type: 'force_levee', en_trop: 1 }],
    ['une date sans fuseau', { ...commun, date: '2026-06-01T10:00:00', type: 'force_levee' }],
    [
      'une date avec décalage',
      { ...commun, date: '2026-06-01T12:00:00+02:00', type: 'force_levee' },
    ],
    ['un jour qui n’existe pas', { ...commun, date: '2026-02-30T10:00:00Z', type: 'force_levee' }],
    ['une date en texte libre', { ...commun, date: 'hier', type: 'force_levee' }],
    ['un identifiant vide', { ...commun, id: ' ', type: 'force_levee' }],
    ['un bloc manquant', { id: 'f1', date: commun.date, type: 'force_levee' }],
    ['un tour à 0', { ...(VALIDES['correction'] as object), tour: 0 }],
    ['un niveau inconnu', { ...(VALIDES['correction'] as object), niveau: 'moyen' }],
    ['une aide à 5', { ...(VALIDES['atelier_resultat'] as object), aide: 5 }],
    ['une durée négative', { ...(VALIDES['aisance_resultat'] as object), dureeS: -1 }],
    ['un statut inconnu', { ...(VALIDES['statut_force'] as object), statut: 'genial' }],
    ['une raison de forçage vide', { ...(VALIDES['statut_force'] as object), raison: '' }],
  ])('refuse %s', (_, fait) => {
    expect(Fait.safeParse(fait).success).toBe(false)
  })

  it('dit en français ce qui ne va pas dans une date', () => {
    const resultat = Fait.safeParse({ ...commun, date: 'hier', type: 'force_levee' })
    expect(resultat.error?.issues[0]?.message).toBe(
      'La date doit être un instant ISO 8601 en UTC, par exemple 2026-06-01T10:00:00Z.',
    )
  })
})

describe('ReponseVerification', () => {
  it('refuse une réussite sur une explication et un niveau sur une tâche', () => {
    const base = { question: 'Q', tour: 1, compte: true }
    expect(
      ReponseVerification.safeParse({ type: 'explication', ...base, reussi: true }).success,
    ).toBe(false)
    expect(
      ReponseVerification.safeParse({ type: 'transfert', ...base, reussi: true }).success,
    ).toBe(false)
    expect(
      ReponseVerification.safeParse({ type: 'tache', ...base, niveau: 'solide' }).success,
    ).toBe(false)
  })
})
