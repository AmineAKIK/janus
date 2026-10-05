import { describe, expect, it } from 'vitest'
import { preuvesDuBloc } from './cartes.ts'
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

function preuves(faits: readonly Fait[], manifeste = MANIFESTE) {
  return preuvesDuBloc(calculerBloc(faits, manifeste, REGLAGES, apres(DEBUT, 900)), REGLAGES)
}

describe('preuvesDuBloc', () => {
  it('n’a aucune preuve pour un bloc sans fait', () => {
    expect(preuves([])).toEqual({
      comprendre: null,
      faireSeul: null,
      transferer: null,
      retenir: null,
      aisance: null,
    })
  })

  it('date comprendre et faire seul avec la fin de la consolidation et de la pratique', () => {
    const resultat = preuves(jusquaProvisoire(fabrique()))
    expect(resultat.comprendre).toEqual({ date: PROVISOIRE })
    expect(resultat.faireSeul).toEqual({ date: apres(DEBUT, 0, 1) })
    expect(resultat.transferer).toBeNull()
    expect(resultat.retenir).toBeNull()
  })

  it('date transférer, et retenir avec la prochaine échéance, après une vérification réussie', () => {
    const f = fabrique()
    const verification = apres(DEBUT, 4)
    const resultat = preuves([...jusquaProvisoire(f), f.verification(verification)])
    expect(resultat.transferer).toEqual({ date: verification })
    expect(resultat.retenir).toEqual({
      date: verification,
      prochaine: { type: 'retest', genre: 'jour', apres: '2026-07-05' },
    })
  })

  it('date retenir avec le dernier retest réussi et la prochaine échéance d’entretien', () => {
    const f = fabrique()
    const retest = apres(DEBUT, 40)
    const faits = [
      ...jusquaProvisoire(f),
      f.verification(apres(DEBUT, 4)),
      f.verification(retest, { verification: 'retest' }),
      f.aisance(retest, 30),
      f.aisance(apres(retest, 1), 30),
    ]
    const resultat = preuves(faits)
    expect(resultat.retenir).toEqual({
      date: retest,
      prochaine: { type: 'entretien', genre: 'jour', apres: '2026-10-11' },
    })
    expect(resultat.aisance).toEqual({ date: apres(retest, 1) })
  })

  it('dit « non requis » quand le manifeste n’a pas de cible d’aisance', () => {
    const sans = { ...MANIFESTE }
    delete sans.aisance
    expect(preuves([], sans).aisance).toBe('non_requis')
  })
})
