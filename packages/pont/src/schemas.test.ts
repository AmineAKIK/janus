import {
  Aide,
  Certitude,
  Confiance,
  CorrectionRecue as CorrectionContrats,
  EXEMPLES_PAGE,
  MessageAppli as MessageAppliContrats,
  MessagePage as MessagePageContrats,
  Niveau,
  RaisonNonCompte,
  Source,
  Statut,
} from '@janus/contrats'
import { describe, expect, it } from 'vitest'
import { CorrectionRecue, MessageAppli, MessagePage } from './schemas.ts'

const ID = '0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b'
const CORRECTION = {
  id: ID,
  echantillon: false,
  question: 'R1',
  tour: 1,
  message: 'Correction simulée (démo) : bien.',
  niveau: 'solide',
  erreurs_critiques: [],
  source: 'support',
  ref: 'cours',
  certitude: 'sur',
  compte: true,
} as const

const MESSAGES_APPLI = [
  {
    type: 'etat.init',
    bloc: 'D01',
    version: 3,
    etat: null,
    statut: 'en_cours',
    serie_ouverte: { restitution: true, consolidation: false },
  },
  {
    type: 'etat.init',
    bloc: 'D01',
    version: 3,
    etat: { etape: 'ET3' },
    statut: 'vu',
    serie_ouverte: { restitution: false, consolidation: true },
  },
  { type: 'restitution.correction', ...CORRECTION },
  { type: 'restitution.correction', ...CORRECTION, compte: false, raison_non_compte: 'relance' },
  {
    type: 'statut.maj',
    statut: 'acquis',
    manque: [{ code: 'retest_a_venir', apres: '2026-10-05' }],
  },
  { type: 'erreur', code: 'plafond_atteint', detail: 'Plafond atteint.', message_id: ID },
  { type: 'erreur', code: 'correction_indisponible', detail: 'Indisponible.' },
  { type: 'etape.aller', etape: 'ET2' },
]

/** Des entrées invalides de chaque sorte : le même verdict des deux côtés. */
const INVALIDES_PAGE = Object.entries(EXEMPLES_PAGE).flatMap(([type, exemple]) => [
  { ...exemple, id: 'pas-un-uuid' },
  { ...exemple, bloc: 'bloc' },
  { ...exemple, version: 0 },
  { ...exemple, t: 'hier' },
  { ...exemple, extra: 1 },
  { ...exemple, type: `${type}.inconnu` },
])

describe('parité avec packages/contrats', () => {
  it.each(Object.entries(EXEMPLES_PAGE))(
    'accepte l’exemple %s comme les contrats',
    (_type, exemple) => {
      expect(MessagePageContrats.safeParse(exemple).success).toBe(true)
      expect(MessagePage.safeParse(exemple).success).toBe(true)
    },
  )

  it.each(INVALIDES_PAGE.map((m, i) => [i, m] as const))(
    'refuse le message invalide %i comme les contrats',
    (_i, message) => {
      expect(MessagePage.safeParse(message).success).toBe(
        MessagePageContrats.safeParse(message).success,
      )
      expect(MessagePage.safeParse(message).success).toBe(false)
    },
  )

  it('refuse les mêmes champs de pratique, de restitution et d’état', () => {
    const base = EXEMPLES_PAGE['pratique.resultat']
    const cas = [
      { ...base, aide: 5 },
      { ...base, essais: 0 },
      { ...EXEMPLES_PAGE['restitution.demande'], reponse: '' },
      { ...EXEMPLES_PAGE['restitution.demande'], reponse: 'x'.repeat(2001) },
      { ...EXEMPLES_PAGE['restitution.demande'], confiance: 'peut-etre' },
      { ...EXEMPLES_PAGE['restitution.demande'], support: { colle: true } },
      { ...EXEMPLES_PAGE['aisance.resultat'], duree_s: -1 },
      { ...EXEMPLES_PAGE['etat.sauver'], etat: { gros: 'x'.repeat(200_001) } },
      { ...EXEMPLES_PAGE['etat.sauver'], etat: [1] },
      { ...EXEMPLES_PAGE['etape.vue'], etape: '   ' },
    ]
    for (const message of cas) {
      expect(MessagePage.safeParse(message).success).toBe(
        MessagePageContrats.safeParse(message).success,
      )
      expect(MessagePage.safeParse(message).success).toBe(false)
    }
  })

  it.each(MESSAGES_APPLI.map((m, i) => [i, m] as const))(
    'accepte le message de l’appli %i comme les contrats',
    (_i, message) => {
      expect(MessageAppliContrats.safeParse(message).success).toBe(true)
      expect(MessageAppli.safeParse(message).success).toBe(true)
    },
  )

  it('refuse les mêmes messages de l’appli invalides', () => {
    const cas = [
      {
        type: 'etat.init',
        bloc: 'D01',
        version: 3,
        etat: null,
        statut: 'inconnu',
        serie_ouverte: { restitution: true, consolidation: false },
      },
      { type: 'statut.maj', statut: 'acquis', manque: [{ code: 'nimporte' }] },
      { type: 'erreur', code: 'autre', detail: 'x' },
      { type: 'erreur', code: 'plafond_atteint', detail: 'x', message_id: 'pas-un-uuid' },
      { type: 'etape.aller' },
      { type: 'restitution.correction', ...CORRECTION, niveau: 'moyen' },
      { type: 'inconnu' },
    ]
    for (const message of cas) {
      expect(MessageAppli.safeParse(message).success).toBe(
        MessageAppliContrats.safeParse(message).success,
      )
      expect(MessageAppli.safeParse(message).success).toBe(false)
    }
  })

  it('la correction reçue suit celle des contrats', () => {
    expect(CorrectionRecue.safeParse(CORRECTION).success).toBe(
      CorrectionContrats.safeParse(CORRECTION).success,
    )
    expect(CorrectionRecue.safeParse({ ...CORRECTION, tour: 0 }).success).toBe(false)
  })

  it('les énumérations sont celles des contrats', () => {
    const valeurs = (
      schema: { safeParse: (v: unknown) => { success: boolean } },
      options: readonly unknown[],
    ) => options.every((option) => schema.safeParse(option).success)
    // Chaque valeur des contrats est acceptée par le schéma du pont, dans un message complet.
    for (const statut of Statut.options) {
      expect(MessageAppli.safeParse({ type: 'statut.maj', statut, manque: [] }).success).toBe(true)
    }
    for (const niveau of Niveau.options)
      expect(CorrectionRecue.safeParse({ ...CORRECTION, niveau }).success).toBe(true)
    for (const source of Source.options)
      expect(CorrectionRecue.safeParse({ ...CORRECTION, source }).success).toBe(true)
    for (const certitude of Certitude.options)
      expect(CorrectionRecue.safeParse({ ...CORRECTION, certitude }).success).toBe(true)
    for (const raison of RaisonNonCompte.options) {
      expect(
        CorrectionRecue.safeParse({ ...CORRECTION, compte: false, raison_non_compte: raison })
          .success,
      ).toBe(true)
    }
    for (const confiance of Confiance.options) {
      expect(
        MessagePage.safeParse({ ...EXEMPLES_PAGE['restitution.demande'], confiance }).success,
      ).toBe(true)
    }
    for (const niveauAide of Aide.def.values) {
      expect(
        MessagePage.safeParse({ ...EXEMPLES_PAGE['pratique.resultat'], aide: niveauAide }).success,
      ).toBe(true)
    }
    expect(valeurs(Statut, Statut.options)).toBe(true)
  })
})
