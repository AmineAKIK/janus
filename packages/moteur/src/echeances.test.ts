import { describe, expect, it } from 'vitest'
import { echeances, estDue } from './echeances.ts'
import type { Echeance } from './echeances.ts'
import {
  apres,
  DEBUT,
  fabrique,
  jusquaProvisoire,
  MANIFESTE,
  PROVISOIRE,
  REGLAGES,
} from './fabrique.ts'
import type { Fait } from './faits.ts'
import { calculerBloc } from './statut.ts'

function etat(faits: readonly Fait[], maintenant = apres(DEBUT, 900)) {
  return calculerBloc(faits, MANIFESTE, REGLAGES, maintenant)
}

describe('echeances', () => {
  it('ne programme rien pour un bloc sans fait ou à peine commencé', () => {
    expect(echeances(etat([]), REGLAGES)).toBeNull()
    expect(echeances(etat(fabrique().pratique(DEBUT)), REGLAGES)).toBeNull()
  })

  it('programme la consolidation une heure après la dernière restitution', () => {
    const f = fabrique()
    const restitution = f.restitution(DEBUT)
    const vu = apres(DEBUT, 0, 4)
    expect(echeances(etat(restitution), REGLAGES)).toEqual({
      type: 'consolidation',
      genre: 'instant',
      apres: apres(vu, 0, 60),
    })
  })

  it('suit le délai de consolidation des réglages', () => {
    const f = fabrique()
    const reglages = { ...REGLAGES, delaiConsolidationMinutes: 90 }
    const resultat = calculerBloc(f.restitution(DEBUT), MANIFESTE, reglages, apres(DEBUT, 1))
    expect(echeances(resultat, reglages)?.apres).toBe(apres(DEBUT, 0, 4 + 90))
  })

  it('programme la consolidation tant que la série est insuffisante', () => {
    const f = fabrique()
    const faits = [
      ...f.restitution(DEBUT),
      ...f.consolidation(apres(DEBUT, 0, 120), ['fragile', 'fragile', 'fragile']),
    ]
    expect(echeances(etat(faits), REGLAGES)?.type).toBe('consolidation')
  })

  it('programme la vérification trois jours (en jours de jourDe) après « acquis provisoirement »', () => {
    const f = fabrique()
    expect(echeances(etat(jusquaProvisoire(f)), REGLAGES)).toEqual({
      type: 'verification',
      genre: 'jour',
      apres: '2026-06-04',
    })
    expect(PROVISOIRE).toBe(apres(DEBUT, 0, 122))
  })

  it('programme le retest trente jours après « acquis »', () => {
    const f = fabrique()
    const verification = apres(DEBUT, 4)
    const faits = [...jusquaProvisoire(f), f.verification(verification)]
    expect(echeances(etat(faits), REGLAGES)).toEqual({
      type: 'retest',
      genre: 'jour',
      apres: '2026-07-05',
    })
  })

  it('programme un nouvel essai deux jours après un échec', () => {
    const f = fabrique()
    const echec = apres(DEBUT, 6)
    const faits = [...jusquaProvisoire(f), f.verification(echec, { tache: false })]
    expect(echeances(etat(faits), REGLAGES)).toEqual({
      type: 'verification',
      genre: 'jour',
      apres: '2026-06-09',
    })
  })

  it('programme le nouvel essai d’un retest raté deux jours après lui', () => {
    const f = fabrique()
    const faits = [
      ...jusquaProvisoire(f),
      f.verification(apres(DEBUT, 4)),
      f.verification(apres(DEBUT, 40), { verification: 'retest', tache: false }),
    ]
    expect(echeances(etat(faits), REGLAGES)).toEqual({
      type: 'retest',
      genre: 'jour',
      apres: '2026-07-13',
    })
  })

  it('suit le délai de nouvel essai des réglages', () => {
    const f = fabrique()
    const reglages = { ...REGLAGES, delaiNouvelEssaiJours: 5 }
    const faits = [...jusquaProvisoire(f), f.verification(apres(DEBUT, 6), { tache: false })]
    const resultat = calculerBloc(faits, MANIFESTE, reglages, apres(DEBUT, 900))
    expect(echeances(resultat, reglages)?.apres).toBe('2026-06-12')
  })

  describe('l’entretien', () => {
    function maitrise(f: ReturnType<typeof fabrique>, entretiens: readonly number[] = []) {
      const retest = apres(DEBUT, 40)
      return [
        ...jusquaProvisoire(f),
        f.verification(apres(DEBUT, 4)),
        f.verification(retest, { verification: 'retest' }),
        ...[0, 1].map((jour) => f.aisance(apres(retest, jour), 30)),
        ...entretiens.map((jour) =>
          f.verification(apres(DEBUT, jour), { verification: 'entretien' }),
        ),
      ]
    }

    it('programme le premier entretien trois mois après le retest réussi', () => {
      const f = fabrique()
      expect(echeances(etat(maitrise(f)), REGLAGES)).toEqual({
        type: 'entretien',
        genre: 'jour',
        apres: '2026-10-11',
      })
    })

    it('programme le suivant six mois après le premier entretien réussi, puis douze mois', () => {
      const f = fabrique()
      expect(echeances(etat(maitrise(f, [150])), REGLAGES)?.apres).toBe('2027-04-29')
      expect(echeances(etat(maitrise(f, [150, 400])), REGLAGES)?.apres).toBe('2028-07-06')
    })

    it('garde douze mois tant que les entretiens réussissent', () => {
      const f = fabrique()
      const faits = maitrise(f, [150, 400, 800])
      expect(echeances(etat(faits), REGLAGES)?.apres).toBe('2029-08-09')
    })

    it('programme un entretien raté deux jours après, sans quitter « maîtrisé »', () => {
      const f = fabrique()
      const faits = [
        ...maitrise(f),
        f.verification(apres(DEBUT, 135), { verification: 'entretien', tache: false }),
      ]
      const resultat = etat(faits)
      expect(resultat.statut).toBe('maitrise')
      expect(echeances(resultat, REGLAGES)).toEqual({
        type: 'entretien',
        genre: 'jour',
        apres: '2026-10-16',
      })
    })

    it('ne programme rien quand le retest est réussi mais que l’aisance manque', () => {
      const f = fabrique()
      const faits = [
        ...jusquaProvisoire(f),
        f.verification(apres(DEBUT, 4)),
        f.verification(apres(DEBUT, 40), { verification: 'retest' }),
      ]
      expect(echeances(etat(faits), REGLAGES)).toBeNull()
    })

    it('ne programme rien sans mois d’entretien dans les réglages', () => {
      const f = fabrique()
      const reglages = { ...REGLAGES, entretienMois: [] }
      const resultat = calculerBloc(maitrise(f), MANIFESTE, reglages, apres(DEBUT, 900))
      expect(echeances(resultat, reglages)).toBeNull()
    })
  })
})

describe('estDue', () => {
  const instant: Echeance = { type: 'consolidation', genre: 'instant', apres: apres(DEBUT, 0, 60) }
  const jour: Echeance = { type: 'verification', genre: 'jour', apres: '2026-06-04' }

  it('compare un instant à l’instant', () => {
    expect(estDue(instant, apres(DEBUT, 0, 59), REGLAGES)).toBe(false)
    expect(estDue(instant, apres(DEBUT, 0, 60), REGLAGES)).toBe(true)
  })

  it('compare un jour au jour de maintenant, avec la bascule de 4 h', () => {
    expect(estDue(jour, '2026-06-04T01:30:00Z', REGLAGES)).toBe(false)
    expect(estDue(jour, '2026-06-04T02:30:00Z', REGLAGES)).toBe(true)
    expect(estDue(jour, '2026-06-09T10:00:00Z', REGLAGES)).toBe(true)
  })
})
