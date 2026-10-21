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

  it('le manque et l’échéance donnent la même date après un échec', () => {
    const f = fabrique()
    const verifRatee = [...jusquaProvisoire(f), f.verification(apres(DEBUT, 6), { tache: false })]
    const retestRate = [
      ...jusquaProvisoire(f),
      f.verification(apres(DEBUT, 4)),
      f.verification(apres(DEBUT, 40), { verification: 'retest', tache: false }),
    ]
    for (const faits of [verifRatee, retestRate]) {
      const resultat = etat(faits, apres(DEBUT, 41))
      const echeance = echeances(resultat, REGLAGES)
      const manque = resultat.manque.find(({ code }) => /^(verification|retest)_/.test(code))

      expect(manque).toBeDefined()
      expect(manque && 'apres' in manque ? manque.apres : null).toBe(echeance?.apres)
    }
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

  describe('après le retest', () => {
    function retestReussi(f: ReturnType<typeof fabrique>) {
      const retest = apres(DEBUT, 40)
      return [
        ...jusquaProvisoire(f),
        f.verification(apres(DEBUT, 4)),
        f.verification(retest, { verification: 'retest' }),
        ...[0, 1].map((jour) => f.aisance(apres(retest, jour), 30)),
      ]
    }

    it('ne programme plus rien une fois le retest réussi : le parcours est clos', () => {
      const f = fabrique()
      expect(echeances(etat(retestReussi(f)), REGLAGES)).toBeNull()
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

    it('programme un retest raté deux jours après, puis plus rien après deux échecs : le bloc est à reprendre', () => {
      const f = fabrique()
      const rate = (jour: number) =>
        f.verification(apres(DEBUT, jour), { verification: 'retest', tache: false })
      const base = [...jusquaProvisoire(f), f.verification(apres(DEBUT, 4))]
      expect(echeances(etat([...base, rate(40)]), REGLAGES)).toEqual({
        type: 'retest',
        genre: 'jour',
        apres: '2026-07-13',
      })
      const repris = etat([...base, rate(40), rate(43)])
      expect(repris.statut).toBe('a_reprendre')
      expect(echeances(repris, REGLAGES)).toBeNull()
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
