import { describe, expect, it } from 'vitest'
import { apres, DEBUT, fabrique, MANIFESTE, REGLAGES } from '../fabrique.ts'
import type { Fait } from '../faits.ts'
import { revueMethode } from './revue.ts'
import type { MesureTemps } from './temps.ts'

const bloc = (code: string) => ({ ...MANIFESTE, bloc: code })
const D01 = bloc('D01')
const D02 = bloc('D02')
const D03 = bloc('D03')
const TOUS = [D01, D02, D03]

/** Un bloc passé à Vu à la date donnée, puis une étape vue (il reste Vu). */
function bloc_vu(code: string, date: string, etapes: readonly string[] = []): Fait[] {
  const f = fabrique(code)
  return [
    ...f.restitution(date),
    ...etapes.map((etape, rang) => f.etape(apres(date, 0, 10 + rang), etape)),
  ]
}

const revue = (
  faits: readonly Fait[],
  derniere: string | null = null,
  mesures: readonly MesureTemps[] = [],
) => revueMethode(faits, mesures, TOUS, derniere, REGLAGES)

describe('revueMethode', () => {
  it('ne propose rien sans fait', () => {
    expect(revue([])).toEqual({
      blocsDepuis: 0,
      blocsRequis: 3,
      aProposer: false,
      tempsS: 0,
      pratiqueS: 0,
      aReprendre: [],
      etapesSautees: [],
    })
  })

  it('propose la revue à 3 blocs passés à Vu, et pas avant', () => {
    const deux = [...bloc_vu('D01', DEBUT), ...bloc_vu('D02', apres(DEBUT, 1))]
    expect(revue(deux)).toMatchObject({ blocsDepuis: 2, aProposer: false })
    const trois = [...deux, ...bloc_vu('D03', apres(DEBUT, 2))]
    expect(revue(trois)).toMatchObject({ blocsDepuis: 3, aProposer: true })
  })

  it('ne compte que les blocs passés à Vu depuis la dernière revue', () => {
    const faits = [
      ...bloc_vu('D01', DEBUT),
      ...bloc_vu('D02', apres(DEBUT, 2)),
      ...bloc_vu('D03', apres(DEBUT, 3)),
    ]
    expect(revue(faits, apres(DEBUT, 1))).toMatchObject({ blocsDepuis: 2, aProposer: false })
  })

  it('suit le réglage de blocs entre deux revues', () => {
    const faits = [...bloc_vu('D01', DEBUT), ...bloc_vu('D02', apres(DEBUT, 1))]
    const mesure = revueMethode(faits, [], TOUS, null, { ...REGLAGES, blocsEntreRevues: 4 })
    expect(mesure).toMatchObject({ blocsRequis: 4, aProposer: false })
  })

  it('ne compte pas un bloc seulement commencé', () => {
    const f = fabrique('D01')
    expect(revue([f.ouverture(DEBUT)]).blocsDepuis).toBe(0)
  })

  it('totalise le temps actif depuis la dernière revue, dont la part passée à pratiquer', () => {
    const mesures: MesureTemps[] = [
      { date: apres(DEBUT, 0), bloc: 'D01', secondes: 1000, etape: 'pratique' },
      { date: apres(DEBUT, 2), bloc: 'D01', secondes: 600, etape: 'pratique' },
      { date: apres(DEBUT, 2), bloc: 'D01', secondes: 300, etape: 'carte' },
      { date: apres(DEBUT, 3), bloc: 'D01', secondes: 100 },
      { date: apres(DEBUT, 3), bloc: 'D01', secondes: 50, etape: 'atelier' },
    ]
    expect(revue([], apres(DEBUT, 1), mesures)).toMatchObject({ tempsS: 1050, pratiqueS: 650 })
    expect(revue([], null, mesures)).toMatchObject({ tempsS: 2050, pratiqueS: 1650 })
  })

  it('liste les notions à reprendre plusieurs fois, la plus répétée d’abord', () => {
    const f = fabrique('D01')
    const g = fabrique('D02')
    const faits = [
      // R1 de D01 : 3 fois pas solide.
      ...[0, 1, 2].map((jour) =>
        f.correction(apres(DEBUT, jour), 'restitution', 'R1', { niveau: 'fragile' }),
      ),
      // R2 de D01 et R1 de D02 : 2 fois chacune, à égalité (ordre par bloc), et R3 de D02 aussi (ordre par question).
      ...[0, 1].map((jour) =>
        f.correction(apres(DEBUT, jour), 'restitution', 'R2', { niveau: 'partiel' }),
      ),
      ...[0, 1].map((jour) =>
        g.correction(apres(DEBUT, jour), 'restitution', 'R3', { niveau: 'partiel' }),
      ),
      ...[0, 1].map((jour) =>
        g.correction(apres(DEBUT, jour), 'restitution', 'R1', { niveau: 'partiel' }),
      ),
      // Une seule fois, solide, relance : ignorées.
      f.correction(apres(DEBUT, 0), 'restitution', 'R4', { niveau: 'fragile' }),
      ...[0, 1].map((jour) =>
        f.correction(apres(DEBUT, jour), 'restitution', 'R5', { niveau: 'solide' }),
      ),
      ...[0, 1].map((jour) =>
        f.correction(apres(DEBUT, jour), 'restitution', 'R6', { niveau: 'fragile', tour: 2 }),
      ),
    ]
    expect(revue(faits).aReprendre).toEqual([
      { bloc: 'D01', question: 'R1', fois: 3 },
      { bloc: 'D01', question: 'R2', fois: 2 },
      { bloc: 'D02', question: 'R1', fois: 2 },
      { bloc: 'D02', question: 'R3', fois: 2 },
    ])
  })

  it('ne regarde que ce qui suit la dernière revue pour les notions à reprendre', () => {
    const f = fabrique('D01')
    const faits = [
      f.correction(apres(DEBUT, 0), 'restitution', 'R1', { niveau: 'fragile' }),
      f.correction(apres(DEBUT, 2), 'restitution', 'R1', { niveau: 'fragile' }),
    ]
    expect(revue(faits, apres(DEBUT, 1)).aReprendre).toEqual([])
  })

  it('liste les étapes jamais vues dans au moins deux blocs vus', () => {
    const faits = [
      // D01 et D02 vus : seule la carte (ET1) est vue dans les deux ; la pré-test (ET2) seulement dans D02.
      ...bloc_vu('D01', DEBUT, ['ET1']),
      ...bloc_vu('D02', apres(DEBUT, 1), ['ET1', 'ET2']),
      // D03 seulement commencé : ses étapes non vues ne comptent pas.
      ...fabrique('D03').restitution(apres(DEBUT, 2)).slice(0, 2),
    ]
    const sautees = revue(faits).etapesSautees
    expect(sautees).toContainEqual({ etape: 'explication', blocs: 2 })
    expect(sautees).toContainEqual({ etape: 'bilan', blocs: 2 })
    expect(sautees.some(({ etape }) => etape === 'carte')).toBe(false)
    // Le pré-test n'est sauté que dans un bloc : pas « souvent ».
    expect(sautees.some(({ etape }) => etape === 'pretest')).toBe(false)
    // À égalité, par ordre alphabétique de type.
    expect(sautees.map(({ etape }) => etape)).toEqual([...sautees.map(({ etape }) => etape)].sort())
  })

  it('classe d’abord l’étape sautée dans le plus de blocs', () => {
    const faits = [
      ...bloc_vu('D01', DEBUT, ['ET1', 'ET2']),
      ...bloc_vu('D02', apres(DEBUT, 1), ['ET1']),
      ...bloc_vu('D03', apres(DEBUT, 2), ['ET1']),
    ]
    const [premiere] = revue(faits).etapesSautees
    expect(premiere).toEqual({ etape: 'aisance', blocs: 3 })
  })
})
