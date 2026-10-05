import type { Manifeste, Reglages, Statut } from '@janus/contrats'
import type { Fait } from './faits.ts'
import { apres, DEBUT, fabrique, jusquaProvisoire, MANIFESTE, REGLAGES } from './fabrique.ts'
import type { Fabrique } from './fabrique.ts'
import type { CodeManque } from './statut.ts'

/**
 * Les cas d'acceptation du cadrage (section « Tests d'acceptation »), écrits une seule fois :
 * les tests du moteur les rejouent, et le serveur (PR-084) les rejouera sur sa propre base.
 */

export interface Attendu {
  readonly statut: Statut
  readonly statutCalcule?: Statut
  /** Codes qui doivent figurer parmi ce qui manque. */
  readonly manque?: readonly CodeManque[]
  readonly erreursOuvertes?: readonly string[]
  readonly echecsConsecutifs?: number
  readonly force?: { readonly statut: Statut; readonly raison: string } | null
}

export interface CasStatut {
  readonly genre: 'statut'
  readonly situation: string
  readonly faits: readonly Fait[]
  readonly manifeste: Manifeste
  readonly reglages: Reglages
  readonly maintenant: string
  readonly attendu: Attendu
  /** Résultats attendus après les `apresFaits` premiers faits seulement. */
  readonly intermediaires?: readonly { readonly apresFaits: number; readonly attendu: Attendu }[]
}

export interface CasAcces {
  readonly genre: 'acces'
  readonly situation: string
  readonly statutsPrerequis: readonly Statut[]
  readonly attendu: 'libre' | 'raison_requise'
}

export interface CasJour {
  readonly genre: 'jour'
  readonly situation: string
  readonly instant: string
  readonly fuseau: string
  readonly heureBascule: number
  readonly attendu: string
}

export type CasAcceptation = CasStatut | CasAcces | CasJour

function cas(
  situation: string,
  faits: readonly Fait[],
  maintenant: string,
  attendu: Attendu,
  intermediaires?: CasStatut['intermediaires'],
): CasStatut {
  return {
    genre: 'statut',
    situation,
    faits,
    manifeste: MANIFESTE,
    reglages: REGLAGES,
    maintenant,
    attendu,
    ...(intermediaires === undefined ? {} : { intermediaires }),
  }
}

/** Pratique, atelier et restitution faits ; la consolidation reste à écrire. */
function avantConsolidation(f: Fabrique): Fait[] {
  return [
    ...f.pratique(DEBUT),
    f.atelier(apres(DEBUT, 0, 5)),
    ...f.restitution(apres(DEBUT, 0, 30)),
  ]
}

/** Deux consolidations qui comptent, puis une troisième qui ne compte pas pour la raison donnée. */
function consolidationSansTroisieme(
  f: Fabrique,
  raison: 'avec_support' | 'recopiee' | 'non_verifiee',
): Fait[] {
  const [c1, c2, c3] = MANIFESTE.consolidation
  return [
    ...avantConsolidation(f),
    f.correction(apres(DEBUT, 0, 120), 'consolidation', c1?.id ?? '', {}),
    f.correction(apres(DEBUT, 0, 121), 'consolidation', c2?.id ?? '', {}),
    f.correction(apres(DEBUT, 0, 122), 'consolidation', c3?.id ?? '', {
      compte: false,
      raisonNonCompte: raison,
    }),
  ]
}

/** Du début jusqu'à « acquis provisoirement », puis la vérification réussie à J+3 : « acquis ». */
function jusquaAcquis(f: Fabrique): Fait[] {
  return [...jusquaProvisoire(f), f.verification(apres(DEBUT, 3))]
}

/** Jusqu'à « acquis », puis la cible d'aisance atteinte (deux essais sous 30 s, deux jours différents). */
function jusquaAcquisAvecAisance(f: Fabrique): Fait[] {
  return [...jusquaAcquis(f), f.aisance(apres(DEBUT, 10), 20), f.aisance(apres(DEBUT, 20), 25)]
}

function construireCas(): CasAcceptation[] {
  const cas1 = ((): CasAcceptation => {
    const f = fabrique()
    return cas(
      'Restitution envoyée, tous les niveaux « fragile »',
      f.restitution(apres(DEBUT, 0, 30), 'fragile'),
      apres(DEBUT, 0, 60),
      { statut: 'vu' },
    )
  })()

  const cas2 = ((): CasAcceptation => {
    const f = fabrique()
    // La restitution finit à 10 h 34 ; la consolidation commence 20 minutes plus tard.
    return cas(
      'Consolidation solide 20 minutes après la restitution',
      [...avantConsolidation(f), ...f.consolidation(apres(DEBUT, 0, 54))],
      apres(DEBUT, 0, 60),
      { statut: 'vu', manque: ['consolidation_trop_tot'] },
    )
  })()

  const cas3 = ((): CasAcceptation => {
    const f = fabrique()
    const [c1, c2, c3] = MANIFESTE.consolidation
    return cas(
      'Consolidation fragile au 1er tour, solide au 2e après un indice',
      [
        ...avantConsolidation(f),
        ...f.consolidation(apres(DEBUT, 0, 120), ['fragile', 'fragile', 'fragile']),
        ...[c1, c2, c3].map((q, i) =>
          f.correction(apres(DEBUT, 0, 125 + i), 'consolidation', q?.id ?? '', {
            tour: 2,
            compte: false,
            raisonNonCompte: 'relance',
          }),
        ),
      ],
      apres(DEBUT, 0, 180),
      { statut: 'vu', manque: ['consolidation_insuffisante'] },
    )
  })()

  const cas4 = ((): CasAcceptation => {
    const f = fabrique()
    return cas(
      'Tous les exercices réussis, mais l’un seulement à l’aide 2',
      [
        ...f.pratique(DEBUT, [0, 2]),
        f.atelier(apres(DEBUT, 0, 5)),
        ...f.restitution(apres(DEBUT, 0, 30)),
        ...f.consolidation(apres(DEBUT, 0, 120)),
      ],
      apres(DEBUT, 0, 180),
      { statut: 'vu', manque: ['pratique_aide'] },
    )
  })()

  const sansCompter = (
    situation: string,
    raison: 'avec_support' | 'recopiee' | 'non_verifiee',
  ): CasAcceptation => {
    const f = fabrique()
    return cas(situation, consolidationSansTroisieme(f, raison), apres(DEBUT, 0, 180), {
      statut: 'vu',
      manque: ['consolidation_a_faire'],
    })
  }

  const cas8 = ((): CasAcceptation => {
    const f = fabrique()
    return cas(
      'Vérification à J+3 réussie, page du bloc ouverte la veille',
      [
        ...jusquaProvisoire(f),
        f.verification(apres(DEBUT, 3), { valable: false, raisonInvalide: 'revu_avant' }),
      ],
      apres(DEBUT, 3, 60),
      { statut: 'acquis_provisoirement', manque: ['verification_a_faire'], echecsConsecutifs: 0 },
    )
  })()

  const cas9 = ((): CasAcceptation => {
    const f = fabrique()
    return cas(
      'Vérification avec explication et tâche réussies, transfert partiel',
      [...jusquaProvisoire(f), f.verification(apres(DEBUT, 3), { transfert: 'partiel' })],
      apres(DEBUT, 3, 60),
      { statut: 'acquis_provisoirement', echecsConsecutifs: 1 },
    )
  })()

  const cas10 = ((): CasAcceptation => {
    const f = fabrique()
    return cas(
      'Acquis, retest réussi à J+20',
      [...jusquaAcquis(f), f.verification(apres(DEBUT, 23), { verification: 'retest' })],
      apres(DEBUT, 23, 60),
      { statut: 'acquis', manque: ['retest_a_venir'] },
    )
  })()

  const cas11 = ((): CasAcceptation => {
    const f = fabrique()
    return cas(
      'Acquis, retest réussi à J+31, cible d’aisance non atteinte',
      [...jusquaAcquis(f), f.verification(apres(DEBUT, 34), { verification: 'retest' })],
      apres(DEBUT, 34, 60),
      { statut: 'acquis', manque: ['aisance_non_atteinte'] },
    )
  })()

  const cas12 = ((): CasAcceptation => {
    const f = fabrique()
    return cas(
      'Acquis, retest réussi à J+31, cible d’aisance atteinte',
      [...jusquaAcquisAvecAisance(f), f.verification(apres(DEBUT, 34), { verification: 'retest' })],
      apres(DEBUT, 34, 60),
      { statut: 'maitrise' },
    )
  })()

  const cas13 = ((): CasAcceptation => {
    const f = fabrique()
    return cas(
      'Maîtrisé, un retest raté sans erreur critique',
      [
        ...jusquaAcquisAvecAisance(f),
        f.verification(apres(DEBUT, 34), { verification: 'retest' }),
        f.verification(apres(DEBUT, 40), { verification: 'retest', transfert: 'fragile' }),
      ],
      apres(DEBUT, 40, 60),
      { statut: 'maitrise', echecsConsecutifs: 1 },
    )
  })()

  const cas14 = ((): CasAcceptation => {
    const f = fabrique()
    return cas(
      'Maîtrisé, deux retests ratés de suite',
      [
        ...jusquaAcquisAvecAisance(f),
        f.verification(apres(DEBUT, 34), { verification: 'retest' }),
        f.verification(apres(DEBUT, 40), { verification: 'retest', transfert: 'fragile' }),
        f.verification(apres(DEBUT, 42), { verification: 'retest', tache: false }),
      ],
      apres(DEBUT, 42, 60),
      { statut: 'acquis' },
    )
  })()

  const cas15 = ((): CasAcceptation => {
    const f = fabrique()
    return cas(
      'Erreur critique repérée par l’IA, non confirmée',
      [
        ...jusquaProvisoire(f),
        f.correction(apres(DEBUT, 1), 'rappel', 'RA1', { niveau: 'fragile', erreursIa: ['E1'] }),
      ],
      apres(DEBUT, 2),
      { statut: 'acquis_provisoirement', erreursOuvertes: [] },
    )
  })()

  const cas16 = ((): CasAcceptation => {
    const f = fabrique()
    const base = jusquaProvisoire(f)
    const avecErreur = [...base, f.cochee(apres(DEBUT, 1), 'E1')]
    return cas(
      'Erreur critique confirmée, puis question solide au 1er tour sur la même erreur',
      [...avecErreur, f.correction(apres(DEBUT, 2), 'consolidation', 'C1', {})],
      apres(DEBUT, 3),
      { statut: 'acquis_provisoirement', erreursOuvertes: [] },
      [
        {
          apresFaits: avecErreur.length,
          attendu: { statut: 'a_reprendre', erreursOuvertes: ['E1'] },
        },
      ],
    )
  })()

  const cas17 = ((): CasAcceptation => {
    const f = fabrique()
    return cas(
      'Contestation à laquelle l’IA se range',
      [
        ...avantConsolidation(f),
        ...f.consolidation(apres(DEBUT, 0, 120), ['pas_encore', 'solide', 'solide']),
        f.correction(apres(DEBUT, 0, 130), 'consolidation', 'C1', {
          tour: 2,
          compte: false,
          raisonNonCompte: 'relance',
        }),
      ],
      apres(DEBUT, 0, 180),
      { statut: 'vu', manque: ['consolidation_insuffisante'] },
    )
  })()

  const cas18 = ((): CasAcceptation => {
    const f = fabrique()
    return cas(
      'Statut forcé',
      [...jusquaProvisoire(f), f.force(apres(DEBUT, 1), 'maitrise', 'Je le connais déjà.')],
      apres(DEBUT, 2),
      {
        statut: 'maitrise',
        statutCalcule: 'acquis_provisoirement',
        force: { statut: 'maitrise', raison: 'Je le connais déjà.' },
      },
    )
  })()

  const cas19 = ((): CasAcceptation => {
    const f = fabrique()
    const [c1, c2] = f.consolidation(apres(DEBUT, 0, 120))
    return cas(
      'Même message reçu deux fois',
      [...avantConsolidation(f), ...(c1 && c2 ? [c1, c2, c2] : [])],
      apres(DEBUT, 0, 180),
      { statut: 'vu', manque: ['consolidation_a_faire'] },
    )
  })()

  return [
    cas1,
    cas2,
    cas3,
    cas4,
    sansCompter('Réponse collée, ou après retour au cours', 'avec_support'),
    sansCompter('Réponse recopiée du cours', 'recopiee'),
    sansCompter('Correction « non vérifiée »', 'non_verifiee'),
    cas8,
    cas9,
    cas10,
    cas11,
    cas12,
    cas13,
    cas14,
    cas15,
    cas16,
    cas17,
    cas18,
    cas19,
    {
      genre: 'jour',
      situation: 'Séance finie à 1 h du matin',
      instant: '2026-07-14T23:30:00Z',
      fuseau: REGLAGES.fuseau,
      heureBascule: REGLAGES.heureBascule,
      attendu: '2026-07-14',
    },
    {
      genre: 'acces',
      situation: 'Prérequis seulement « vu »',
      statutsPrerequis: ['acquis', 'vu'],
      attendu: 'raison_requise',
    },
  ]
}

export const CAS_ACCEPTATION: readonly CasAcceptation[] = construireCas()
