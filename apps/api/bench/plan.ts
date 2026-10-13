import { createHash } from 'node:crypto'
import { manifesteDuBloc } from '@janus/contrats/demo'
import type { Manifeste } from '@janus/contrats'

// Le plan de la base de mesure : 10 modules de 4 parties de 5 blocs, soit 200 blocs (le titre complet
// d'une formation en compte autour de ce nombre). Les manifestes sont ceux de la démo, un par bloc.

export const MODULES = Array.from({ length: 10 }, (_, i) => ({
  code: `M${String(i + 1)}`,
  ordre: i + 1,
}))
export const PARTIES_PAR_MODULE = 4
export const BLOCS_PAR_PARTIE = 5

export interface BlocDeMesure {
  readonly module: string
  readonly partie: string
  readonly rangPartie: number
  readonly code: string
  readonly titre: string
  readonly ordre: number
  readonly empreinte: string
  readonly manifeste: Manifeste
}

export function planDeMesure(): BlocDeMesure[] {
  const plan: BlocDeMesure[] = []
  let numero = 0
  for (const m of MODULES) {
    let ordre = 0
    for (let p = 1; p <= PARTIES_PAR_MODULE; p += 1) {
      for (let b = 1; b <= BLOCS_PAR_PARTIE; b += 1) {
        numero += 1
        ordre += 1
        const code = `B${String(numero).padStart(3, '0')}`
        const precedent = numero > 1 ? [`B${String(numero - 1).padStart(3, '0')}`] : []
        plan.push({
          module: m.code,
          partie: `P${String(p)}`,
          rangPartie: p,
          code,
          titre: `Bloc ${code}`,
          ordre,
          empreinte: createHash('sha256').update(code).digest('hex'),
          manifeste: manifesteDuBloc({
            code,
            titre: `Bloc ${code}`,
            prerequis: precedent,
            partie: `P${String(p)}`,
          }),
        })
      }
    }
  }
  return plan
}
