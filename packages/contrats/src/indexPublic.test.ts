import { describe, expect, it } from 'vitest'
import * as publique from './index.ts'
import * as demo from './demoIndex.ts'

describe("l'index public", () => {
  it("n'exporte ni la graine ni l'état de démo, réservés à @janus/contrats/demo", () => {
    expect(Object.keys(publique)).not.toContain('PLAN_GRAINE')
    expect(Object.keys(publique)).not.toContain('EtatDemo')
    expect(Object.keys(demo)).toEqual(expect.arrayContaining(['PLAN_GRAINE', 'EtatDemo']))
  })
})
