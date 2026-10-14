import { describe, expect, it } from 'vitest'
import { apres, DEBUT, fabrique, MANIFESTE, REGLAGES } from './fabrique.ts'
import { calculerBloc } from './statut.ts'
import type { Fait } from './faits.ts'

const MAINTENANT = apres(DEBUT, 1)

function etapesVues(faits: readonly Fait[]) {
  return calculerBloc(faits, MANIFESTE, REGLAGES, MAINTENANT).etapesVues
}

describe('les étapes vues', () => {
  it('n’en donne aucune sans fait', () => {
    expect(etapesVues([])).toEqual([])
  })

  it('garde chaque étape vue une fois, dans l’ordre de la première vue', () => {
    const f = fabrique()
    const faits = [
      f.etape(DEBUT, 'ET1'),
      f.etape(apres(DEBUT, 0, 1), 'ET3'),
      f.etape(apres(DEBUT, 0, 2), 'ET1'),
      f.etape(apres(DEBUT, 0, 3), 'ET2'),
    ]
    expect(etapesVues(faits)).toEqual(['ET1', 'ET3', 'ET2'])
  })

  it('ne dépend pas de l’ordre d’arrivée des faits', () => {
    const f = fabrique()
    const tard = f.etape(apres(DEBUT, 0, 3), 'ET2')
    const tot = f.etape(DEBUT, 'ET1')
    expect(etapesVues([tard, tot])).toEqual(['ET1', 'ET2'])
  })
})
