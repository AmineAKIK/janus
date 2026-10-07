import { describe, expect, it } from 'vitest'
import { apres, DEBUT, fabrique, jusquaProvisoire, MANIFESTE, REGLAGES } from '../fabrique.ts'
import { lignesDuJournal, pageDuJournal, TAILLE_PAGE_JOURNAL } from './lignes.ts'
import type { LigneJournal } from './lignes.ts'

const CONTEXTE = { manifestes: { [MANIFESTE.bloc]: MANIFESTE }, reglages: REGLAGES }
const du = (type: LigneJournal['type'], lignes: readonly LigneJournal[]) =>
  lignes.filter((ligne) => ligne.type === type)

describe('lignesDuJournal', () => {
  it('séance : ouverture, étapes, exercices et atelier d’un jour en une ligne', () => {
    const f = fabrique()
    const lignes = lignesDuJournal(
      [
        f.ouverture(DEBUT),
        f.etape(apres(DEBUT, 0, 1), 'ET1'),
        f.fait(apres(DEBUT, 0, 3), {
          type: 'pratique_resultat',
          exercice: 'PR1',
          item: 'PR1-9',
          reussi: false,
          aide: 1,
        }),
        ...f.pratique(apres(DEBUT, 0, 2)),
        f.atelier(apres(DEBUT, 0, 5)),
      ],
      CONTEXTE,
    )

    const [seance] = du('seance', lignes)
    expect(du('seance', lignes)).toHaveLength(1)
    expect(seance?.resume).toBe(
      'bloc ouvert · 1 étape vue · 2 sur 3 exercices réussis · atelier réussi',
    )
    expect(seance?.detail).toContain('Étape ET1 vue')
  })

  it('séance : un bloc ouvert sans prérequis le dit, avec sa raison dans le détail', () => {
    const f = fabrique()
    const ouvert = f.fait(DEBUT, {
      type: 'bloc_ouvert',
      horsPrerequis: true,
      raison: 'Je veux avancer.',
    })

    const [seance] = lignesDuJournal([ouvert], CONTEXTE)

    expect(seance?.resume).toBe('ouvert sans les prérequis')
    expect(seance?.detail).toEqual(['Bloc ouvert · Raison : Je veux avancer.'])
  })

  it('séance : aisance atteinte ou non, atelier à reprendre', () => {
    const f = fabrique()
    const faits = [
      f.fait(DEBUT, { type: 'atelier_resultat', reussi: false, aide: 2 }),
      f.aisance(apres(DEBUT, 0, 1), 40, false),
      f.aisance(apres(DEBUT, 0, 2), 30, true),
    ]

    const [seance] = lignesDuJournal(faits, CONTEXTE)

    expect(seance?.resume).toBe(
      'atelier à reprendre · aisance pas encore atteinte · aisance atteinte',
    )
    expect(seance?.detail).toEqual([
      'Atelier · à reprendre · aide 2',
      'Aisance · pas encore · 40 s',
      'Aisance · réussie · 30 s',
    ])
  })

  it('restitution : combien comptent, pourquoi les autres non, statut inchangé', () => {
    const f = fabrique()
    const faits = [
      f.correction(DEBUT, 'restitution', 'R1'),
      f.correction(apres(DEBUT, 0, 1), 'restitution', 'R2', {
        compte: false,
        raisonNonCompte: 'recopiee',
      }),
    ]

    const [restitution] = du('restitution', lignesDuJournal(faits, CONTEXTE))

    expect(restitution?.resume).toBe('1 sur 2 comptées · 1 ne compte pas (collé)')
    expect(restitution?.detail).toEqual(['R1 · solide', 'R2 · solide · ne compte pas'])
  })

  it('restitution : une question qui ne compte pas sans raison ne met pas de parenthèse', () => {
    const f = fabrique()
    const faits = [f.correction(DEBUT, 'restitution', 'R1', { compte: false })]

    expect(du('restitution', lignesDuJournal(faits, CONTEXTE))[0]?.resume).toBe(
      '0 sur 1 comptées · 1 ne compte pas',
    )
  })

  it('restitution : « statut inchangé » quand la série ne change pas le statut', () => {
    const f = fabrique()
    const faits = [f.ouverture(DEBUT), f.correction(apres(DEBUT, 0, 5), 'restitution', 'R1')]

    expect(du('restitution', lignesDuJournal(faits, CONTEXTE))[0]?.resume).toBe(
      '1 sur 1 comptées · statut inchangé',
    )
  })

  it('consolidation : une ligne distincte de la restitution, avec le changement de statut à part', () => {
    const f = fabrique()
    const lignes = lignesDuJournal(jusquaProvisoire(f), CONTEXTE)

    const [consolidation] = du('consolidation', lignes)
    expect(consolidation?.resume).toBe('3 sur 3 comptées')
    expect(du('restitution', lignes)).toHaveLength(1)
    expect(du('changement_statut', lignes).map(({ resume }) => resume)).toContain(
      'Vu → Acquis provisoirement',
    )
  })

  it('vérification : valable ou non, avec la raison quand elle est invalide', () => {
    const f = fabrique()
    const lignes = lignesDuJournal(
      [
        f.verification(DEBUT),
        f.verification(apres(DEBUT, 1), {
          valable: false,
          raisonInvalide: 'Trop tôt.',
          verification: 'retest',
        }),
      ],
      CONTEXTE,
    )

    expect(du('verification', lignes).map(({ resume }) => resume)).toEqual([
      'Retest · non valable · Trop tôt.',
      'Vérification · 3 sur 3 comptées',
    ])
  })

  it('vérification : une réponse qui ne compte pas le dit dans le détail', () => {
    const f = fabrique()
    const verification = f.fait(DEBUT, {
      type: 'verification_terminee',
      verification: 'verification',
      valable: true,
      reponses: [{ type: 'tache', question: 'DT1', tour: 1, reussi: false, compte: false }],
    })

    const [ligne] = du('verification', lignesDuJournal([verification], CONTEXTE))

    expect(ligne?.resume).toBe('Vérification · 0 sur 1 comptées')
    expect(ligne?.detail).toEqual(['DT1 · tache · ne compte pas'])
  })

  it('changement de statut : de l’ancien au nouveau statut, sans doublon avec un forçage', () => {
    const f = fabrique()
    const lignes = lignesDuJournal([f.force(DEBUT, 'acquis', 'Je le maîtrise déjà.')], CONTEXTE)

    expect(du('changement_statut', lignes).map(({ resume }) => resume)).toEqual([
      'Non commencé → En cours',
    ])
    expect(du('statut_force', lignes)[0]?.resume).toBe(
      'Forcé à Acquis · Raison : Je le maîtrise déjà.',
    )
  })

  it('erreur critique : cochée ou décochée, avec son libellé', () => {
    const f = fabrique()
    const erreur = MANIFESTE.erreurs_critiques[0]
    const lignes = lignesDuJournal(
      [
        f.cochee(DEBUT, erreur?.id ?? ''),
        f.fait(apres(DEBUT, 0, 1), {
          type: 'erreur_cochee',
          erreur: 'E404',
          source: 'ia_confirmee',
        }),
        f.decochee(apres(DEBUT, 1), erreur?.id ?? ''),
      ],
      CONTEXTE,
    )

    expect(du('erreur_critique', lignes).map(({ resume }) => resume)).toEqual([
      `${erreur?.libelle ?? ''} · décochée par toi`,
      'E404 · cochée repérée par l’IA, confirmée',
      `${erreur?.libelle ?? ''} · cochée par toi`,
    ])
  })

  it('contestation : une nouvelle correction et un forçage ne la ferment pas', () => {
    const f = fabrique()
    const correction = f.correction(DEBUT, 'restitution', 'R1')
    const contestation = f.fait(apres(DEBUT, 0, 1), {
      type: 'correction_contestee',
      correction: correction.id,
    })
    const suivante = f.correction(apres(DEBUT, 0, 2), 'restitution', 'R1', { compte: false })
    const force = f.force(apres(DEBUT, 0, 3), 'vu', 'Décision indépendante.')

    const lignes = lignesDuJournal([correction, contestation, suivante, force], CONTEXTE)
    const [ligne] = du('contestation', lignes)

    expect(ligne).toMatchObject({
      type: 'contestation',
      resume: 'R1 · correction contestée',
      contestationEnAttente: true,
    })
    expect(pageDuJournal(lignes, { type: 'contestation' }).lignes).toEqual([ligne])
  })

  it('contestation : reste lisible si la correction référencée manque', () => {
    const f = fabrique()
    const contestation = f.fait(DEBUT, {
      type: 'correction_contestee',
      correction: 'correction-inconnue',
    })

    const [ligne] = du('contestation', lignesDuJournal([contestation], CONTEXTE))

    expect(ligne).toMatchObject({
      resume: 'Correction contestée',
      detail: [],
      contestationEnAttente: true,
    })
  })

  it('contestation : un tranchage humain postérieur la résout', () => {
    const f = fabrique()
    const correction = f.correction(DEBUT, 'restitution', 'R1')
    const contestation = f.fait(apres(DEBUT, 0, 1), {
      type: 'correction_contestee',
      correction: correction.id,
    })
    const tranchage = f.fait(apres(DEBUT, 0, 2), {
      type: 'correction_tranchee',
      correction: correction.id,
      compte: true,
    })

    const [ligne] = du(
      'contestation',
      lignesDuJournal([correction, contestation, tranchage], CONTEXTE),
    )

    expect(ligne?.contestationEnAttente).toBe(false)
  })

  it('statut forcé : le forçage et son retour au calculé', () => {
    const f = fabrique()
    const lignes = lignesDuJournal(
      [f.force(DEBUT, 'vu', 'Vu en cours.'), f.levee(apres(DEBUT, 1))],
      CONTEXTE,
    )

    expect(du('statut_force', lignes).map(({ resume }) => resume)).toEqual([
      'Retour au statut calculé',
      'Forcé à Vu · Raison : Vu en cours.',
    ])
  })

  it('classe les lignes de plusieurs blocs, la plus récente d’abord, sans manifeste connu', () => {
    const a = fabrique('B01')
    const b = fabrique('B02')
    const lignes = lignesDuJournal([a.cochee(DEBUT, 'E1'), b.cochee(apres(DEBUT, 1), 'E2')], {
      manifestes: {},
      reglages: REGLAGES,
    })

    expect(lignes.map(({ bloc }) => bloc)).toEqual(['B02', 'B01'])
  })

  it('ne rend rien sans fait', () => {
    expect(lignesDuJournal([], CONTEXTE)).toEqual([])
  })
})

describe('pageDuJournal', () => {
  const faits = (n: number) => {
    const f = fabrique()
    return Array.from({ length: n }, (_, i) => f.cochee(apres(DEBUT, 0, i), 'E1'))
  }

  it('rend tout quand il y a moins de 50 lignes', () => {
    const lignes = lignesDuJournal(faits(3), CONTEXTE)

    expect(pageDuJournal(lignes, {})).toEqual({ lignes, suivant: null })
  })

  it('coupe à 50 et donne l’instant de la page suivante, qui reprend sans trou', () => {
    const lignes = lignesDuJournal(faits(120), CONTEXTE)

    const premiere = pageDuJournal(lignes, {})
    expect(premiere.lignes).toHaveLength(TAILLE_PAGE_JOURNAL)
    expect(premiere.suivant).toBe(premiere.lignes.at(-1)?.date)

    const deuxieme = pageDuJournal(lignes, { avant: premiere.suivant ?? '' })
    const troisieme = pageDuJournal(lignes, { avant: deuxieme.suivant ?? '' })
    expect([...premiere.lignes, ...deuxieme.lignes, ...troisieme.lignes]).toEqual(lignes)
    expect(troisieme.suivant).toBeNull()
  })

  it('garde ensemble les lignes de même instant à la coupure', () => {
    const f = fabrique()
    const memeInstant = Array.from({ length: 60 }, () => f.cochee(DEBUT, 'E1'))

    const page = pageDuJournal(lignesDuJournal(memeInstant, CONTEXTE), {})

    const lignes = lignesDuJournal(memeInstant, CONTEXTE)
    expect(page.lignes).toHaveLength(lignes.length)
    expect(lignes.length).toBeGreaterThan(TAILLE_PAGE_JOURNAL)
    expect(page.suivant).toBeNull()
  })

  it('filtre par bloc et par type', () => {
    const a = fabrique('B01')
    const b = fabrique('B02')
    const lignes = lignesDuJournal(
      [
        a.cochee(DEBUT, 'E1'),
        b.cochee(apres(DEBUT, 1), 'E1'),
        b.force(apres(DEBUT, 2), 'vu', 'Test.'),
      ],
      { manifestes: {}, reglages: REGLAGES },
    )

    expect(pageDuJournal(lignes, { bloc: 'B02' }).lignes).toHaveLength(2)
    expect(pageDuJournal(lignes, { bloc: 'B02', type: 'statut_force' }).lignes).toHaveLength(1)
    expect(pageDuJournal(lignes, { type: 'seance' }).lignes).toEqual([])
  })
})
