import { describe, expect, it } from 'vitest'
import { apres, DEBUT, fabrique } from './fabrique.ts'
import { faitsParBloc } from './parBloc.ts'

describe('faitsParBloc', () => {
  it('range les faits par bloc, dans leur ordre, les blocs dans l’ordre de leur premier fait', () => {
    const a = fabrique('B02')
    const b = fabrique('B01')
    const faits = [
      a.etape(apres(DEBUT, 0), 'ET1'),
      b.etape(apres(DEBUT, 1), 'ET1'),
      a.etape(apres(DEBUT, 2), 'ET2'),
      b.etape(apres(DEBUT, 3), 'ET2'),
    ]
    const parBloc = faitsParBloc(faits)
    expect([...parBloc.keys()]).toEqual(['B02', 'B01'])
    expect(parBloc.get('B02')).toEqual([faits[0], faits[2]])
    expect(parBloc.get('B01')).toEqual([faits[1], faits[3]])
  })

  it('ne rend rien sans fait', () => {
    expect(faitsParBloc([]).size).toBe(0)
  })
})
