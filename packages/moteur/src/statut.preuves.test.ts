import { describe, expect, it } from 'vitest'
import {
  apres,
  DEBUT,
  fabrique,
  jusquaProvisoire,
  MANIFESTE,
  PROVISOIRE,
  REGLAGES,
} from './fabrique.ts'
import { calculerBloc } from './statut.ts'
import type { Fait } from './faits.ts'

const MAINTENANT = apres(DEBUT, 400)

function preuves(faits: readonly Fait[]) {
  return calculerBloc(faits, MANIFESTE, REGLAGES, MAINTENANT).preuves
}

describe('les dates des preuves', () => {
  it('ne donne aucune date sans fait, et dit que l’aisance est demandée', () => {
    expect(preuves([])).toEqual({
      consolidation: null,
      pratique: null,
      atelier: null,
      transfert: null,
      aisance: null,
      aisanceRequise: true,
      derniereReussite: null,
      reussitesDeRetest: [],
      dernierEchec: null,
    })
  })

  it('date la série de consolidation réussie et la pratique', () => {
    const f = fabrique()
    const resultat = preuves(jusquaProvisoire(f))
    expect(resultat.consolidation).toBe(PROVISOIRE)
    expect(resultat.pratique).toBe(apres(DEBUT, 0, 1))
    expect(resultat.transfert).toBeNull()
  })

  it('ne date pas la consolidation tant que la restitution n’est pas finie', () => {
    const f = fabrique()
    expect(preuves(f.consolidation(apres(DEBUT, 0, 120))).consolidation).toBeNull()
  })

  it('ne date pas la pratique quand un exercice n’est pas atteint à l’aide 0', () => {
    const f = fabrique()
    expect(preuves(f.pratique(DEBUT, [0, 2])).pratique).toBeNull()
  })

  it('date le premier atelier réussi à l’aide 0', () => {
    const f = fabrique()
    const reussi = apres(DEBUT, 0, 5)
    const resultat = preuves([
      f.atelier(apres(DEBUT, 0, 2), 2),
      f.atelier(reussi),
      f.atelier(apres(DEBUT, 0, 9)),
    ])
    expect(resultat.atelier).toBe(reussi)
  })

  it('ne date pas un atelier réussi seulement avec de l’aide', () => {
    const f = fabrique()
    expect(preuves([f.atelier(DEBUT, 1)]).atelier).toBeNull()
  })

  it('date le premier transfert solide d’une vérification valable, puis la dernière réussite', () => {
    const f = fabrique()
    const premiere = apres(DEBUT, 3)
    const faits = [
      ...jusquaProvisoire(f),
      f.verification(apres(DEBUT, 1), { transfert: 'fragile', valable: false }),
      f.verification(premiere, { transfert: 'solide' }),
    ]
    const resultat = preuves(faits)
    expect(resultat.transfert).toBe(premiere)
    expect(resultat.derniereReussite).toBe(premiere)
    expect(resultat.dernierEchec).toBeNull()
  })

  it('ne date aucun transfert quand les transferts ne sont pas solides', () => {
    const f = fabrique()
    const faits = [
      ...jusquaProvisoire(f),
      f.verification(apres(DEBUT, 4), { transfert: 'fragile' }),
    ]
    const resultat = preuves(faits)
    expect(resultat.transfert).toBeNull()
    expect(resultat.dernierEchec).toBe(apres(DEBUT, 4))
    expect(resultat.derniereReussite).toBeNull()
  })

  it('compte la réussite de retest et efface l’échec après une réussite', () => {
    const f = fabrique()
    const v = apres(DEBUT, 4)
    const r1 = apres(v, 31)
    const faits = [
      ...jusquaProvisoire(f),
      f.verification(apres(DEBUT, 3), { transfert: 'fragile' }),
      f.verification(v),
      f.verification(r1, { verification: 'retest', tache: false }),
      f.verification(apres(r1, 2), { verification: 'retest' }),
    ]
    const resultat = preuves(faits)
    expect(resultat.reussitesDeRetest).toEqual([apres(r1, 2)])
    expect(resultat.derniereReussite).toBe(apres(r1, 2))
    expect(resultat.dernierEchec).toBeNull()
  })

  it('oublie les preuves de relance quand le bloc est mis à reprendre', () => {
    const f = fabrique()
    const v = apres(DEBUT, 4)
    const r1 = apres(v, 31)
    const faits = [
      ...jusquaProvisoire(f),
      f.verification(v),
      f.verification(r1, { verification: 'retest', tache: false }),
      f.verification(apres(r1, 3), { verification: 'retest', tache: false }),
    ]
    const resultat = preuves(faits)
    expect(resultat.reussitesDeRetest).toEqual([])
    expect(resultat.derniereReussite).toBeNull()
    expect(resultat.dernierEchec).toBeNull()
  })

  it('date la cible d’aisance, ou dit qu’elle n’est pas demandée', () => {
    const f = fabrique()
    const faits = [0, 1, 2].map((jour) => f.aisance(apres(DEBUT, jour), 30))
    expect(preuves(faits).aisance).toBe(apres(DEBUT, 1))
    const sansAisance = { ...MANIFESTE }
    delete sansAisance.aisance
    const resultat = calculerBloc([], sansAisance, REGLAGES, MAINTENANT).preuves
    expect(resultat.aisanceRequise).toBe(false)
    expect(resultat.aisance).toBeNull()
  })
})

describe('l’ordre des relances', () => {
  const base = (f: ReturnType<typeof fabrique>) => [
    ...jusquaProvisoire(f),
    f.verification(apres(DEBUT, 4)),
  ]

  it('ne retient pas une relance d’un autre type comme retest', () => {
    const f = fabrique()
    const faits = [...base(f), f.verification(apres(DEBUT, 35), { verification: 'entretien' })]
    const resultat = calculerBloc(faits, MANIFESTE, REGLAGES, MAINTENANT)
    expect(resultat.statutCalcule).toBe('acquis')
    expect(resultat.preuves.reussitesDeRetest).toEqual([])
  })

  it('ne retient pas un second retest après le premier', () => {
    const f = fabrique()
    const faits = [
      ...base(f),
      f.verification(apres(DEBUT, 40), { verification: 'retest' }),
      f.verification(apres(DEBUT, 135), { verification: 'retest' }),
    ]
    expect(preuves(faits).reussitesDeRetest).toEqual([apres(DEBUT, 40)])
  })
})
