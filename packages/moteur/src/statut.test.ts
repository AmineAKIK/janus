import { describe, expect, it } from 'vitest'
import { CAS_ACCEPTATION } from './casAcceptation.ts'
import {
  apres,
  DEBUT,
  fabrique,
  jusquaProvisoire,
  MANIFESTE,
  PROVISOIRE,
  REGLAGES,
} from './fabrique.ts'
import type { Fabrique } from './fabrique.ts'
import { accesBloc, calculerBloc } from './statut.ts'
import { jourDe } from './temps.ts'
import { Fait as SchemaFait } from '@janus/contrats'
import type { Niveau } from '@janus/contrats'
import type { Fait, ReponseVerification } from './faits.ts'

function calcul(faits: readonly Fait[], maintenant: string = apres(DEBUT, 60)) {
  return calculerBloc(faits, MANIFESTE, REGLAGES, maintenant)
}

function codes(faits: readonly Fait[], maintenant?: string): string[] {
  return calcul(faits, maintenant).manque.map((manque) => manque.code)
}

describe('les cas d’acceptation du cadrage', () => {
  for (const cas of CAS_ACCEPTATION) {
    it(cas.situation, () => {
      if (cas.genre === 'acces') {
        expect(accesBloc(cas.statutsPrerequis)).toBe(cas.attendu)
      } else if (cas.genre === 'jour') {
        expect(jourDe(cas.instant, cas.fuseau, cas.heureBascule)).toBe(cas.attendu)
      } else {
        const etapes = [
          ...(cas.intermediaires ?? []).map(({ apresFaits, attendu }) => ({
            faits: cas.faits.slice(0, apresFaits),
            attendu,
          })),
          { faits: cas.faits, attendu: cas.attendu },
        ]
        for (const { faits, attendu } of etapes) {
          const resultat = calculerBloc(faits, cas.manifeste, cas.reglages, cas.maintenant)
          expect(resultat.statut).toBe(attendu.statut)
          if (attendu.statutCalcule !== undefined) {
            expect(resultat.statutCalcule).toBe(attendu.statutCalcule)
          }
          for (const code of attendu.manque ?? []) {
            expect(resultat.manque.map((m) => m.code)).toContain(code)
          }
          if (attendu.erreursOuvertes !== undefined) {
            expect(resultat.erreursOuvertes).toEqual(attendu.erreursOuvertes)
          }
          if (attendu.echecsConsecutifs !== undefined) {
            expect(resultat.echecsConsecutifs).toBe(attendu.echecsConsecutifs)
          }
          if (attendu.force !== undefined) expect(resultat.force).toEqual(attendu.force)
        }
      }
    })
  }

  it('couvre les 21 lignes du tableau', () => {
    expect(CAS_ACCEPTATION).toHaveLength(21)
  })
})

describe('accesBloc', () => {
  it('ouvre librement quand tous les prérequis sont au moins acquis provisoirement', () => {
    expect(accesBloc(['acquis_provisoirement', 'acquis', 'maitrise'])).toBe('libre')
    expect(accesBloc([])).toBe('libre')
  })

  it.each(['non_commence', 'en_cours', 'vu', 'a_reprendre'] as const)(
    'demande une raison si un prérequis est %s',
    (statut) => {
      expect(accesBloc(['acquis', statut])).toBe('raison_requise')
    },
  )
})

describe('les paliers, un par un', () => {
  it('aucun fait : non commencé, avec toute la restitution à faire', () => {
    const resultat = calcul([])
    expect(resultat.statut).toBe('non_commence')
    expect(resultat.manque).toEqual([
      { code: 'restitution_incomplete', questions: MANIFESTE.restitution.map((q) => q.id) },
    ])
    expect(resultat.dates).toEqual({
      vu: null,
      acquisProvisoirement: null,
      acquis: null,
      maitrise: null,
    })
  })

  it('un fait d’un autre bloc ne compte pas', () => {
    const f = fabrique('B99')
    expect(calcul([f.ouverture(DEBUT)]).statut).toBe('non_commence')
  })

  it('un fait, restitution incomplète : en cours, avec les questions manquantes', () => {
    const f = fabrique()
    const [r1, r2, r3, r4] = f.restitution(DEBUT)
    const resultat = calcul([r1, r2, r3, r4].flatMap((fait) => (fait ? [fait] : [])))
    expect(resultat.statut).toBe('en_cours')
    expect(resultat.manque[0]).toEqual({ code: 'restitution_incomplete', questions: ['R5'] })
  })

  it('un bloc sans question de restitution n’est jamais vu', () => {
    const f = fabrique()
    const sans = { ...MANIFESTE, restitution: [] }
    const resultat = calculerBloc([f.ouverture(DEBUT)], sans, REGLAGES, DEBUT)
    expect(resultat.statut).toBe('en_cours')
  })

  it('vu : la date est celle de la dernière question de restitution', () => {
    const f = fabrique()
    const resultat = calcul(f.restitution(DEBUT, 'pas_encore'))
    expect(resultat.statut).toBe('vu')
    expect(resultat.dates.vu).toBe(apres(DEBUT, 0, 4))
  })

  it('une relance de restitution (tour 2) ne suffit pas pour être vu', () => {
    const f = fabrique()
    const faits = MANIFESTE.restitution.map((q, i) =>
      f.correction(apres(DEBUT, 0, i), 'restitution', q.id, { tour: 2, compte: false }),
    )
    expect(calcul(faits).statut).toBe('en_cours')
  })

  it('acquis provisoirement : la date est celle de la fin de la consolidation', () => {
    const f = fabrique()
    const resultat = calcul(jusquaProvisoire(f))
    expect(resultat.statut).toBe('acquis_provisoirement')
    expect(resultat.dates).toEqual({
      vu: apres(DEBUT, 0, 34),
      acquisProvisoirement: PROVISOIRE,
      acquis: null,
      maitrise: null,
    })
  })

  it('la date d’acquis provisoirement est celle de la dernière condition remplie', () => {
    const f = fabrique()
    // La pratique et l’atelier sont finis après la consolidation.
    const tard = [
      ...f.restitution(DEBUT),
      ...f.consolidation(apres(DEBUT, 0, 90)),
      ...f.pratique(apres(DEBUT, 0, 200)),
      f.atelier(apres(DEBUT, 0, 300)),
    ]
    expect(calcul(tard).dates.acquisProvisoirement).toBe(apres(DEBUT, 0, 300))
    // La pratique arrive en dernier, l’atelier plus tôt.
    const pratiqueEnDernier = [
      ...f.restitution(DEBUT),
      ...f.consolidation(apres(DEBUT, 0, 90)),
      f.atelier(apres(DEBUT, 0, 100)),
      ...f.pratique(apres(DEBUT, 0, 200)),
    ]
    expect(calcul(pratiqueEnDernier).dates.acquisProvisoirement).toBe(apres(DEBUT, 0, 201))
  })

  it('un bloc sans pratique ni atelier ni aisance n’en exige pas', () => {
    const f = fabrique()
    const simple = { ...MANIFESTE, pratique: [], atelier: undefined, aisance: undefined }
    const faits = [...f.restitution(DEBUT), ...f.consolidation(apres(DEBUT, 0, 90))]
    const resultat = calculerBloc(faits, simple, REGLAGES, apres(DEBUT, 0, 120))
    expect(resultat.statut).toBe('acquis_provisoirement')
    expect(resultat.dates.acquisProvisoirement).toBe(apres(DEBUT, 0, 92))
  })
})

describe('la consolidation', () => {
  it('attend la fin du délai : trop tôt tant que l’heure n’est pas venue, puis à faire', () => {
    const f = fabrique()
    const faits = [...f.pratique(DEBUT), f.atelier(DEBUT), ...f.restitution(apres(DEBUT, 0, 30))]
    const tot = calcul(faits, apres(DEBUT, 0, 40)).manque
    expect(tot).toContainEqual({ code: 'consolidation_trop_tot', apres: apres(DEBUT, 0, 94) })
    expect(calcul(faits, apres(DEBUT, 0, 95)).manque).toContainEqual({
      code: 'consolidation_a_faire',
    })
  })

  it('respecte le délai réglé : 90 minutes', () => {
    const f = fabrique()
    const faits = [...jusquaProvisoire(f)]
    const reglages = { ...REGLAGES, delaiConsolidationMinutes: 90 }
    // La consolidation commence 86 minutes après la dernière restitution : trop tôt.
    expect(calculerBloc(faits, MANIFESTE, reglages, apres(DEBUT, 1)).statut).toBe('vu')
    expect(calculerBloc(faits, MANIFESTE, REGLAGES, apres(DEBUT, 1)).statut).toBe(
      'acquis_provisoirement',
    )
  })

  it('rouvrir le cours entre la restitution et la consolidation annule la série', () => {
    for (const etape of ['ET1', 'ET2', 'ET3', 'ET4', 'ET5', 'ET6']) {
      const f = fabrique()
      const faits = [
        ...f.pratique(DEBUT),
        f.atelier(DEBUT),
        ...f.restitution(apres(DEBUT, 0, 30)),
        f.etape(apres(DEBUT, 0, 60), etape),
        ...f.consolidation(apres(DEBUT, 0, 120)),
      ]
      const resultat = calcul(faits, apres(DEBUT, 0, 200))
      expect(resultat.statut).toBe('vu')
      expect(resultat.manque.map((m) => m.code)).toContain('consolidation_cours_rouvert')
    }
  })

  it('les étapes de restitution, de consolidation et de bilan, ou inconnues, n’annulent rien', () => {
    for (const etape of ['ET7', 'ET8', 'ET9', 'INCONNUE']) {
      const f = fabrique()
      const faits = [
        ...f.pratique(DEBUT),
        f.atelier(DEBUT),
        ...f.restitution(apres(DEBUT, 0, 30)),
        f.etape(apres(DEBUT, 0, 60), etape),
        ...f.consolidation(apres(DEBUT, 0, 120)),
      ]
      expect(calcul(faits, apres(DEBUT, 0, 200)).statut).toBe('acquis_provisoirement')
    }
  })

  it('une étape de cours vue avant la restitution ou après la consolidation n’annule rien', () => {
    const f = fabrique()
    const faits = [
      f.etape(DEBUT, 'ET3'),
      ...f.pratique(DEBUT),
      f.atelier(DEBUT),
      ...f.restitution(apres(DEBUT, 0, 30)),
      ...f.consolidation(apres(DEBUT, 0, 120)),
      f.etape(apres(DEBUT, 0, 200), 'ET3'),
    ]
    expect(calcul(faits, apres(DEBUT, 0, 300)).statut).toBe('acquis_provisoirement')
  })

  it('compte 0,8 de points : 3 réponses solides, solide, partiel passent, deux partiels non', () => {
    const f = fabrique()
    const avec = (
      niveaux: readonly [
        'solide' | 'partiel' | 'fragile',
        'solide' | 'partiel' | 'fragile',
        'solide' | 'partiel' | 'fragile',
      ],
    ) =>
      calcul([
        ...f.pratique(DEBUT),
        f.atelier(DEBUT),
        ...f.restitution(apres(DEBUT, 0, 30)),
        ...f.consolidation(apres(DEBUT, 0, 120), niveaux),
      ]).statut
    expect(avec(['solide', 'solide', 'partiel'])).toBe('acquis_provisoirement')
    expect(avec(['solide', 'partiel', 'partiel'])).toBe('vu')
    expect(avec(['solide', 'solide', 'fragile'])).toBe('vu')
  })

  it('le seuil réglé s’applique, et le manque donne les points obtenus et requis', () => {
    const f = fabrique()
    const faits = [
      ...f.pratique(DEBUT),
      f.atelier(DEBUT),
      ...f.restitution(apres(DEBUT, 0, 30)),
      ...f.consolidation(apres(DEBUT, 0, 120), ['solide', 'partiel', 'partiel']),
    ]
    const permissif = calculerBloc(
      faits,
      MANIFESTE,
      { ...REGLAGES, seuilConsolidation: 0.6 },
      DEBUT,
    )
    expect(permissif.statut).toBe('acquis_provisoirement')
    const strict = calcul(faits, apres(DEBUT, 0, 200))
    expect(strict.manque).toContainEqual({
      code: 'consolidation_insuffisante',
      points: 2 / 3,
      requis: 0.8,
    })
  })

  it('une réponse qui ne compte pas est remplacée par une autre question de la réserve', () => {
    const f = fabrique()
    const [c1, c2, c3] = MANIFESTE.consolidation
    const faits = [
      ...f.pratique(DEBUT),
      f.atelier(DEBUT),
      ...f.restitution(apres(DEBUT, 0, 30)),
      f.correction(apres(DEBUT, 0, 120), 'consolidation', c1?.id ?? '', {}),
      f.correction(apres(DEBUT, 0, 121), 'consolidation', c2?.id ?? '', {}),
      f.correction(apres(DEBUT, 0, 122), 'consolidation', c3?.id ?? '', {
        compte: false,
        raisonNonCompte: 'recopiee',
      }),
      f.correction(apres(DEBUT, 0, 123), 'consolidation', c3?.id ?? '', {}),
    ]
    const resultat = calcul(faits, apres(DEBUT, 0, 200))
    expect(resultat.statut).toBe('acquis_provisoirement')
    expect(resultat.dates.acquisProvisoirement).toBe(apres(DEBUT, 0, 123))
  })

  it('une série ratée n’empêche pas une série suivante réussie', () => {
    const f = fabrique()
    const faits = [
      ...f.pratique(DEBUT),
      f.atelier(DEBUT),
      ...f.restitution(apres(DEBUT, 0, 30)),
      ...f.consolidation(apres(DEBUT, 0, 120), ['fragile', 'fragile', 'fragile']),
      ...f.consolidation(apres(DEBUT, 1), ['solide', 'solide', 'solide']),
    ]
    const resultat = calcul(faits, apres(DEBUT, 2))
    expect(resultat.statut).toBe('acquis_provisoirement')
    expect(resultat.dates.acquisProvisoirement).toBe(apres(DEBUT, 1, 2))
  })

  it('une consolidation faite avant toute restitution n’est jamais valable', () => {
    const f = fabrique()
    const faits = [
      ...f.consolidation(DEBUT),
      ...f.pratique(DEBUT),
      f.atelier(DEBUT),
      ...f.restitution(apres(DEBUT, 1)),
    ]
    const resultat = calcul(faits, apres(DEBUT, 2))
    expect(resultat.statut).toBe('vu')
    expect(resultat.manque.map((m) => m.code)).toContain('consolidation_trop_tot')
  })

  it('une consolidation de relances seulement ne compte pas du tout', () => {
    const f = fabrique()
    const faits = [
      ...f.pratique(DEBUT),
      f.atelier(DEBUT),
      ...f.restitution(apres(DEBUT, 0, 30)),
      f.correction(apres(DEBUT, 0, 120), 'consolidation', 'C1', { tour: 2, compte: false }),
    ]
    expect(codes(faits, apres(DEBUT, 0, 200))).toEqual(['consolidation_a_faire'])
  })
})

describe('les faits sur des éléments qui ne sont pas dans le manifeste', () => {
  it('une consolidation sur des questions inconnues ne compte pas', () => {
    const f = fabrique()
    const inconnues = ['X1', 'X2', 'X3'].map((question, i) =>
      f.correction(apres(DEBUT, 0, 120 + i), 'consolidation', question, {}),
    )
    const faits = [
      ...f.pratique(DEBUT),
      f.atelier(DEBUT),
      ...f.restitution(apres(DEBUT, 0, 30)),
      ...inconnues,
    ]
    expect(codes(faits, apres(DEBUT, 0, 200))).toEqual(['consolidation_a_faire'])
  })

  it('une question de restitution ou de rappel ne remplace pas une question de consolidation', () => {
    const f = fabrique()
    const autres = ['R1', 'R2', 'RA1'].map((question, i) =>
      f.correction(apres(DEBUT, 0, 120 + i), 'consolidation', question, {}),
    )
    const faits = [
      ...f.pratique(DEBUT),
      f.atelier(DEBUT),
      ...f.restitution(apres(DEBUT, 0, 30)),
      ...autres,
    ]
    expect(calcul(faits, apres(DEBUT, 0, 200)).statut).toBe('vu')
  })

  it('des résultats de pratique sur des items inconnus ne comptent pas', () => {
    const f = fabrique()
    const inconnus = ['X1', 'X2'].map((item, i) =>
      f.fait(apres(DEBUT, 0, i), {
        type: 'pratique_resultat',
        exercice: 'PR1',
        item,
        reussi: true,
        aide: 0,
      }),
    )
    const faits = [...inconnus, f.atelier(DEBUT), ...f.restitution(apres(DEBUT, 0, 30))]
    expect(codes(faits)).toContain('pratique_aide')
  })

  it('tous les faits des cas d’acceptation passent le schéma de contrats', () => {
    for (const cas of CAS_ACCEPTATION) {
      if (cas.genre === 'statut') {
        for (const fait of cas.faits) expect(SchemaFait.safeParse(fait).success).toBe(true)
      }
    }
  })
})

describe('la pratique et l’atelier', () => {
  it('chaque exercice doit atteindre sa règle à l’aide 0, sur des items différents', () => {
    const f = fabrique()
    const doublon = [
      f.fait(DEBUT, {
        type: 'pratique_resultat',
        exercice: 'PR1',
        item: 'PR1-1',
        reussi: true,
        aide: 0,
      }),
      f.fait(apres(DEBUT, 0, 1), {
        type: 'pratique_resultat',
        exercice: 'PR1',
        item: 'PR1-1',
        reussi: true,
        aide: 0,
      }),
    ]
    const faits = [...doublon, f.atelier(DEBUT), ...f.restitution(apres(DEBUT, 0, 30))]
    expect(calcul(faits).manque).toContainEqual({ code: 'pratique_aide', exercices: ['PR1'] })
  })

  it('un item raté ou un autre exercice ne compte pas', () => {
    const f = fabrique()
    const faits = [
      f.fait(DEBUT, {
        type: 'pratique_resultat',
        exercice: 'PR1',
        item: 'PR1-1',
        reussi: false,
        aide: 0,
      }),
      f.fait(DEBUT, {
        type: 'pratique_resultat',
        exercice: 'AUTRE',
        item: 'X',
        reussi: true,
        aide: 0,
      }),
      f.fait(DEBUT, {
        type: 'pratique_resultat',
        exercice: 'PR1',
        item: 'PR1-2',
        reussi: true,
        aide: 1,
      }),
      ...f.restitution(apres(DEBUT, 0, 30)),
    ]
    expect(codes(faits)).toContain('pratique_aide')
  })

  it('l’atelier doit être réussi à l’aide 0', () => {
    const f = fabrique()
    const base = [...f.pratique(DEBUT), ...f.restitution(apres(DEBUT, 0, 30))]
    expect(codes([...base, f.atelier(DEBUT, 1)])).toContain('atelier_manquant')
    expect(codes(base)).toContain('atelier_manquant')
    expect(
      codes([...base, f.fait(DEBUT, { type: 'atelier_resultat', reussi: false, aide: 0 })]),
    ).toContain('atelier_manquant')
    expect(codes([...base, f.atelier(DEBUT)])).not.toContain('atelier_manquant')
  })
})

describe('les erreurs critiques', () => {
  it('une erreur cochée prime sur tout, une seule fois même cochée deux fois', () => {
    const f = fabrique()
    const faits = [
      ...jusquaProvisoire(f),
      f.cochee(apres(DEBUT, 1), 'E1'),
      f.cochee(apres(DEBUT, 2), 'E1'),
    ]
    const resultat = calcul(faits, apres(DEBUT, 3))
    expect(resultat.statut).toBe('a_reprendre')
    expect(resultat.statutCalcule).toBe('a_reprendre')
    expect(resultat.erreursOuvertes).toEqual(['E1'])
    expect(resultat.manque).toContainEqual({ code: 'erreur_ouverte', erreurs: ['E1'] })
  })

  it('les erreurs ouvertes gardent l’ordre d’ouverture', () => {
    const f = fabrique()
    const faits = [f.cochee(DEBUT, 'E2'), f.cochee(apres(DEBUT, 0, 1), 'E1')]
    expect(calcul(faits).erreursOuvertes).toEqual(['E2', 'E1'])
  })

  it('décocher ferme l’erreur, et la cocher de nouveau la rouvre', () => {
    const f = fabrique()
    const base = [
      ...jusquaProvisoire(f),
      f.cochee(apres(DEBUT, 1), 'E1'),
      f.decochee(apres(DEBUT, 2), 'E1'),
    ]
    expect(calcul(base, apres(DEBUT, 3)).statut).toBe('acquis_provisoirement')
    expect(calcul([...base, f.cochee(apres(DEBUT, 4), 'E1')], apres(DEBUT, 5)).statut).toBe(
      'a_reprendre',
    )
  })

  it('décocher une erreur qui n’est pas ouverte ne fait rien', () => {
    const f = fabrique()
    expect(
      calcul([...jusquaProvisoire(f), f.decochee(apres(DEBUT, 1), 'E1')]).erreursOuvertes,
    ).toEqual([])
  })

  it.each([
    ['restitution', 'R1'],
    ['consolidation', 'C1'],
  ] as const)(
    'une réponse solide au 1er tour en %s sur la même erreur la ferme',
    (serie, question) => {
      const f = fabrique()
      const faits = [f.cochee(DEBUT, 'E1'), f.correction(apres(DEBUT, 1), serie, question, {})]
      expect(calcul(faits).erreursOuvertes).toEqual([])
    },
  )

  it.each([
    ['au 2e tour', { tour: 2 }],
    ['au niveau partiel', { niveau: 'partiel' as const }],
    ['qui ne compte pas', { compte: false }],
  ])('une réponse %s ne ferme pas l’erreur', (_, options) => {
    const f = fabrique()
    const faits = [
      f.cochee(DEBUT, 'E1'),
      f.correction(apres(DEBUT, 1), 'consolidation', 'C1', options),
    ]
    expect(calcul(faits).erreursOuvertes).toEqual(['E1'])
  })

  it('une réponse solide sur une autre erreur, ou en questions de début de séance, ne ferme rien', () => {
    const f = fabrique()
    const faits = [
      f.cochee(DEBUT, 'E1'),
      f.correction(apres(DEBUT, 1), 'consolidation', 'C2', {}),
      f.correction(apres(DEBUT, 2), 'rappel', 'RA1', {}),
      f.correction(apres(DEBUT, 3), 'consolidation', 'INCONNUE', {}),
    ]
    expect(calcul(faits).erreursOuvertes).toEqual(['E1'])
  })

  it('une vérification retenue ferme l’erreur par une réponse réussie du premier tour', () => {
    const f = fabrique()
    const base = jusquaProvisoire(f)
    const verification = (
      reponse: ReponseVerification,
      options: { jours?: number; verification?: 'verification' | 'retest'; valable?: boolean } = {},
    ) =>
      f.fait(apres(DEBUT, options.jours ?? 3), {
        type: 'verification_terminee',
        verification: options.verification ?? 'verification',
        valable: options.valable ?? true,
        reponses: [reponse],
      })
    const ouvertes = (erreur: string, fait: Fait) =>
      calcul([...base, f.cochee(apres(DEBUT, 1), erreur), fait], apres(DEBUT, 40)).erreursOuvertes
    const explication = (niveau: Niveau | null = 'solide'): ReponseVerification => ({
      type: 'explication',
      question: 'DE1',
      tour: 1,
      compte: true,
      ...(niveau === null ? {} : { niveau }),
    })
    const tache = (
      reussi: boolean,
      extra: { tour?: number; compte?: boolean } = {},
    ): ReponseVerification => ({
      type: 'tache',
      question: 'DT2',
      tour: extra.tour ?? 1,
      compte: extra.compte ?? true,
      reussi,
    })

    expect(ouvertes('E1', verification(explication()))).toEqual([])
    expect(ouvertes('E2', verification(tache(true)))).toEqual([])
    // Réponse pas assez bonne, ou qui ne compte pas.
    expect(ouvertes('E2', verification(tache(false)))).toEqual(['E2'])
    expect(ouvertes('E2', verification(tache(true, { tour: 2 })))).toEqual(['E2'])
    expect(ouvertes('E2', verification(tache(true, { compte: false })))).toEqual(['E2'])
    expect(ouvertes('E1', verification(explication('partiel')))).toEqual(['E1'])
    expect(ouvertes('E1', verification(explication(null)))).toEqual(['E1'])
    // Vérification que le calcul ignore : invalide, trop tôt, ou retest alors que le bloc n’est pas encore acquis.
    expect(ouvertes('E1', verification(explication(), { valable: false }))).toEqual(['E1'])
    expect(ouvertes('E1', verification(explication(), { jours: 2 }))).toEqual(['E1'])
    expect(ouvertes('E1', verification(explication(), { verification: 'retest' }))).toEqual(['E1'])
  })

  it('une vérification avant que le bloc soit acquis provisoirement ne ferme rien', () => {
    const f = fabrique()
    const faits = [f.cochee(DEBUT, 'E1'), f.verification(apres(DEBUT, 5))]
    expect(calcul(faits, apres(DEBUT, 6)).erreursOuvertes).toEqual(['E1'])
  })

  it('un bloc revient au statut que ses preuves justifient une fois l’erreur fermée', () => {
    const f = fabrique()
    const faits = [
      ...jusquaProvisoire(f),
      f.verification(apres(DEBUT, 3)),
      f.cochee(apres(DEBUT, 4), 'E3'),
      f.decochee(apres(DEBUT, 5), 'E3'),
    ]
    expect(calcul(faits, apres(DEBUT, 5, 60)).statut).toBe('acquis')
  })
})

describe('la vérification, le retest et les échecs', () => {
  it('une vérification trop tôt est ignorée : pas encore proposée', () => {
    const f = fabrique()
    const faits = [...jusquaProvisoire(f), f.verification(apres(DEBUT, 2))]
    const resultat = calcul(faits, apres(DEBUT, 2, 60))
    expect(resultat.statut).toBe('acquis_provisoirement')
    expect(resultat.echecsConsecutifs).toBe(0)
    expect(resultat.manque).toContainEqual({ code: 'verification_a_venir', apres: '2026-06-04' })
  })

  it('une vérification réussie à J+3 donne acquis, avec sa date', () => {
    const f = fabrique()
    const resultat = calcul(
      [...jusquaProvisoire(f), f.verification(apres(DEBUT, 3))],
      apres(DEBUT, 3, 60),
    )
    expect(resultat.statut).toBe('acquis')
    expect(resultat.dates.acquis).toBe(apres(DEBUT, 3))
    expect(resultat.manque).toContainEqual({ code: 'retest_a_venir', apres: '2026-07-04' })
  })

  it('le délai de vérification réglé s’applique', () => {
    const f = fabrique()
    const faits = [...jusquaProvisoire(f), f.verification(apres(DEBUT, 3))]
    const long = { ...REGLAGES, delaiVerificationJours: 7 }
    expect(calculerBloc(faits, MANIFESTE, long, apres(DEBUT, 4)).statut).toBe(
      'acquis_provisoirement',
    )
  })

  it('une vérification qui ne contient pas les trois types, ou à moitié comptée, ne réussit pas', () => {
    const f = fabrique()
    const base = jusquaProvisoire(f)
    const reponses = [
      { type: 'explication', question: 'DE1', tour: 1, niveau: 'solide', compte: true },
      { type: 'tache', question: 'DT1', tour: 1, reussi: true, compte: true },
      { type: 'transfert', question: 'DR1', tour: 1, niveau: 'solide', compte: true },
    ] as const
    const avec = (modif: (typeof reponses)[number][]) =>
      calcul(
        [
          ...base,
          f.fait(apres(DEBUT, 3), {
            type: 'verification_terminee',
            verification: 'verification',
            valable: true,
            reponses: modif,
          }),
        ],
        apres(DEBUT, 4),
      ).statut
    expect(avec([...reponses])).toBe('acquis')
    expect(avec(reponses.slice(1))).toBe('acquis_provisoirement')
    expect(avec(reponses.filter((r) => r.type !== 'tache'))).toBe('acquis_provisoirement')
    expect(avec(reponses.filter((r) => r.type !== 'transfert'))).toBe('acquis_provisoirement')
  })

  it('une explication au 2e tour, non comptée ou partielle, ou une tâche ratée, fait échouer', () => {
    const f = fabrique()
    const base = jusquaProvisoire(f)
    const essai = (explication: Record<string, unknown>) =>
      calcul(
        [
          ...base,
          f.fait(apres(DEBUT, 3), {
            type: 'verification_terminee',
            verification: 'verification',
            valable: true,
            reponses: [
              {
                type: 'explication',
                question: 'DE1',
                tour: 1,
                niveau: 'solide',
                compte: true,
                ...explication,
              },
              { type: 'tache', question: 'DT1', tour: 1, reussi: true, compte: true },
              { type: 'transfert', question: 'DR1', tour: 1, niveau: 'solide', compte: true },
            ],
          }),
        ],
        apres(DEBUT, 4),
      ).statut
    expect(essai({})).toBe('acquis')
    expect(essai({ tour: 2 })).toBe('acquis_provisoirement')
    expect(essai({ compte: false })).toBe('acquis_provisoirement')
    expect(essai({ niveau: 'partiel' })).toBe('acquis_provisoirement')
  })

  it('un échec de vérification laisse le statut et compte ; une réussite remet à zéro', () => {
    const f = fabrique()
    const base = jusquaProvisoire(f)
    const rate = (jour: number) => f.verification(apres(DEBUT, jour), { transfert: 'fragile' })
    expect(calcul([...base, rate(3)], apres(DEBUT, 4)).echecsConsecutifs).toBe(1)
    // Au provisoire, plusieurs échecs ne font pas descendre plus bas.
    const deux = calcul([...base, rate(3), rate(5), rate(7)], apres(DEBUT, 8))
    expect(deux.statut).toBe('acquis_provisoirement')
    expect(deux.echecsConsecutifs).toBe(3)
    const reussi = calcul([...base, rate(3), f.verification(apres(DEBUT, 5))], apres(DEBUT, 6))
    expect(reussi.statut).toBe('acquis')
    expect(reussi.echecsConsecutifs).toBe(0)
  })

  it('un retest valable ignoré tant qu’il n’est pas à l’heure, et une vérification ne vaut pas retest', () => {
    const f = fabrique()
    const faits = [
      ...jusquaProvisoire(f),
      f.verification(apres(DEBUT, 3)),
      f.verification(apres(DEBUT, 40)),
    ]
    expect(calcul(faits, apres(DEBUT, 41)).statut).toBe('acquis')
    expect(calcul(faits, apres(DEBUT, 41)).manque.map((m) => m.code)).toEqual(['retest_a_faire'])
  })

  it('un retest invalide est ignoré', () => {
    const f = fabrique()
    const faits = [
      ...jusquaProvisoire(f),
      f.verification(apres(DEBUT, 3)),
      f.verification(apres(DEBUT, 40), {
        verification: 'retest',
        valable: false,
        raisonInvalide: 'revu_avant',
      }),
    ]
    const resultat = calcul(faits, apres(DEBUT, 41))
    expect(resultat.statut).toBe('acquis')
    expect(resultat.echecsConsecutifs).toBe(0)
  })

  it('un retest en retard est accepté', () => {
    const f = fabrique()
    const faits = [
      ...jusquaProvisoire(f),
      f.verification(apres(DEBUT, 3)),
      f.aisance(apres(DEBUT, 10), 20),
      f.aisance(apres(DEBUT, 20), 20),
      f.verification(apres(DEBUT, 100), { verification: 'retest' }),
    ]
    const resultat = calcul(faits, apres(DEBUT, 101))
    expect(resultat.statut).toBe('maitrise')
    expect(resultat.dates.maitrise).toBe(apres(DEBUT, 100))
  })

  it('la date de maîtrise est celle du fait qui remplit la dernière condition', () => {
    const f = fabrique()
    const retest = f.verification(apres(DEBUT, 34), { verification: 'retest' })
    const base = [...jusquaProvisoire(f), f.verification(apres(DEBUT, 3)), retest]
    // Aisance atteinte après le retest.
    const aisanceTard = [...base, f.aisance(apres(DEBUT, 40), 20), f.aisance(apres(DEBUT, 41), 20)]
    expect(calcul(aisanceTard, apres(DEBUT, 42)).dates.maitrise).toBe(apres(DEBUT, 41))
    // Aisance atteinte avant le retest.
    const aisanceTot = [...base, f.aisance(apres(DEBUT, 10), 20), f.aisance(apres(DEBUT, 11), 20)]
    expect(calcul(aisanceTot, apres(DEBUT, 42)).dates.maitrise).toBe(apres(DEBUT, 34))
    // Un deuxième retest réussi (entretien) ne décale pas la date.
    const entretien = f.verification(apres(DEBUT, 120), { verification: 'entretien' })
    expect(calcul([...aisanceTot, entretien], apres(DEBUT, 130)).dates.maitrise).toBe(
      apres(DEBUT, 34),
    )
  })

  it('un bloc sans cible d’aisance est maîtrisé dès le retest réussi', () => {
    const f = fabrique()
    const sans = { ...MANIFESTE, aisance: undefined }
    const faits = [
      ...jusquaProvisoire(f),
      f.verification(apres(DEBUT, 3)),
      f.verification(apres(DEBUT, 34), { verification: 'retest' }),
    ]
    const resultat = calculerBloc(faits, sans, REGLAGES, apres(DEBUT, 35))
    expect(resultat.statut).toBe('maitrise')
    expect(resultat.dates.maitrise).toBe(apres(DEBUT, 34))
  })

  it('deux échecs de retest au niveau acquis font redescendre à acquis provisoirement', () => {
    const f = fabrique()
    const rate = (jour: number) =>
      f.verification(apres(DEBUT, jour), { verification: 'retest', tache: false })
    const faits = [...jusquaProvisoire(f), f.verification(apres(DEBUT, 3)), rate(34), rate(36)]
    const resultat = calcul(faits, apres(DEBUT, 37))
    expect(resultat.statut).toBe('acquis_provisoirement')
    expect(resultat.dates.acquis).toBeNull()
    // Une nouvelle vérification réussie le remonte à acquis.
    const remonte = calcul([...faits, f.verification(apres(DEBUT, 40))], apres(DEBUT, 41))
    expect(remonte.statut).toBe('acquis')
    expect(remonte.dates.acquis).toBe(apres(DEBUT, 40))
  })

  it('le nombre d’échecs avant descente est un réglage', () => {
    const f = fabrique()
    const rate = (jour: number) =>
      f.verification(apres(DEBUT, jour), { verification: 'retest', tache: false })
    const faits = [...jusquaProvisoire(f), f.verification(apres(DEBUT, 3)), rate(34), rate(36)]
    const patient = { ...REGLAGES, echecsAvantDescente: 3 }
    expect(calculerBloc(faits, MANIFESTE, patient, apres(DEBUT, 37)).statut).toBe('acquis')
  })
})

describe('l’aisance', () => {
  const sans = (f: Fabrique) => [...jusquaProvisoire(f), f.verification(apres(DEBUT, 3))]

  it('il faut assez d’essais réussis sous la durée max, sur assez de jours différents', () => {
    const f = fabrique()
    const retest = f.verification(apres(DEBUT, 34), { verification: 'retest' })
    const statut = (essais: Fait[]) =>
      calcul([...sans(f), ...essais, retest], apres(DEBUT, 35)).statut
    expect(statut([f.aisance(apres(DEBUT, 10), 20), f.aisance(apres(DEBUT, 11), 20)])).toBe(
      'maitrise',
    )
    // Deux essais le même jour (Paris) : un seul jour.
    expect(statut([f.aisance(apres(DEBUT, 10), 20), f.aisance(apres(DEBUT, 10, 5), 20)])).toBe(
      'acquis',
    )
    // Un essai trop long ou raté ne compte pas.
    expect(statut([f.aisance(apres(DEBUT, 10), 31), f.aisance(apres(DEBUT, 11), 20)])).toBe(
      'acquis',
    )
    expect(statut([f.aisance(apres(DEBUT, 10), 20, false), f.aisance(apres(DEBUT, 11), 20)])).toBe(
      'acquis',
    )
    // Pile à la durée max : accepté.
    expect(statut([f.aisance(apres(DEBUT, 10), 30), f.aisance(apres(DEBUT, 11), 30)])).toBe(
      'maitrise',
    )
  })

  it('une seule réussite ne suffit pas quand il en faut deux', () => {
    const f = fabrique()
    const retest = f.verification(apres(DEBUT, 34), { verification: 'retest' })
    expect(
      calcul([...sans(f), f.aisance(apres(DEBUT, 10), 20), retest], apres(DEBUT, 35)).statut,
    ).toBe('acquis')
  })
})

describe('le statut forcé', () => {
  it('le dernier forçage gagne, le calcul continue, et une levée le retire', () => {
    const f = fabrique()
    const base = jusquaProvisoire(f)
    const deux = [
      ...base,
      f.force(apres(DEBUT, 1), 'acquis', 'première raison'),
      f.force(apres(DEBUT, 2), 'vu', 'seconde raison'),
    ]
    const resultat = calcul(deux, apres(DEBUT, 3))
    expect(resultat.statut).toBe('vu')
    expect(resultat.statutCalcule).toBe('acquis_provisoirement')
    expect(resultat.force).toEqual({ statut: 'vu', raison: 'seconde raison' })
    const leve = calcul([...deux, f.levee(apres(DEBUT, 3))], apres(DEBUT, 4))
    expect(leve.statut).toBe('acquis_provisoirement')
    expect(leve.force).toBeNull()
  })

  it('un forçage donne le statut forcé même en présence d’une erreur ouverte', () => {
    const f = fabrique()
    const resultat = calcul(
      [f.cochee(DEBUT, 'E1'), f.force(apres(DEBUT, 1), 'acquis', 'raison')],
      apres(DEBUT, 2),
    )
    expect(resultat.statut).toBe('acquis')
    expect(resultat.statutCalcule).toBe('a_reprendre')
  })
})

describe('l’ordre et les doublons', () => {
  it('trie par date puis par identifiant, les ex æquo dans les deux sens', () => {
    const f = fabrique()
    const premier = f.ouverture(DEBUT)
    const second = f.ouverture(DEBUT)
    expect(calcul([second, premier]).statut).toBe('en_cours')
    expect(calcul([premier, second]).statut).toBe('en_cours')
  })

  it('un fait reçu deux fois est compté une fois', () => {
    const f = fabrique()
    const [c1, c2] = f.consolidation(apres(DEBUT, 0, 120))
    const faits = [
      ...f.pratique(DEBUT),
      f.atelier(DEBUT),
      ...f.restitution(apres(DEBUT, 0, 30)),
      ...(c1 && c2 ? [c1, c2, c2] : []),
    ]
    expect(calcul(faits, apres(DEBUT, 1)).statut).toBe('vu')
  })

  it('l’heure d’envoi n’est jamais lue : seules les dates des faits comptent', () => {
    const f = fabrique()
    const faits = jusquaProvisoire(f)
    const tot = calcul(faits, DEBUT)
    const tard = calcul(faits, apres(DEBUT, 400))
    expect(tot.statut).toBe(tard.statut)
    expect(tot.dates).toEqual(tard.dates)
  })

  it('refuse une date de fait illisible', () => {
    const f = fabrique()
    expect(() => calcul([f.ouverture('hier')])).toThrow('Instant illisible : hier')
  })
})
