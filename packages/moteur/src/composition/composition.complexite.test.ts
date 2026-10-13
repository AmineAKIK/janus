import { describe, expect, it } from 'vitest'
import { apres, DEBUT, fabrique, MANIFESTE, REGLAGES } from '../fabrique.ts'
import type { Fait } from '../faits.ts'
import type { BlocImporte } from './bloc.ts'
import { composerExport, composerJournal } from './journal.ts'
import { composerTableau } from './tableau.ts'

const MAINTENANT = apres(DEBUT, 50)
const NOMBRE_DE_BLOCS = 60

const blocs: BlocImporte[] = Array.from({ length: NOMBRE_DE_BLOCS }, (_, i) => {
  const code = `B${String(i).padStart(3, '0')}`
  return {
    code,
    moduleCode: 'M1',
    partie: '1.1 Partie',
    manifeste: { ...MANIFESTE, bloc: code },
  }
})
const modules = [{ id: 'M1', titre: 'Module' }]

/** Trois faits par bloc : peu de travail par bloc, beaucoup de blocs. */
function faitsDesBlocs(): Fait[] {
  return blocs.flatMap(({ code }, rang) => {
    const f = fabrique(code)
    return [
      f.etape(apres(DEBUT, rang % 20, 1), 'ET1'),
      f.etape(apres(DEBUT, rang % 20, 2), 'ET3'),
      f.cochee(apres(DEBUT, rang % 20, 3), 'E1'),
    ]
  })
}

/** Compte les lectures du champ `bloc` : filtrer tous les faits pour chaque bloc les multiplie par le nombre de blocs. */
function lecturesDeBloc(faits: readonly Fait[]) {
  const lectures = { total: 0 }
  const observes = faits.map(
    (fait) =>
      new Proxy(fait, {
        get(cible, propriete, destinataire) {
          if (propriete === 'bloc') lectures.total += 1
          const valeur: unknown = Reflect.get(cible, propriete, destinataire)
          return valeur
        },
      }),
  )
  return { lectures, observes }
}

describe('la composition range les faits par bloc une fois, au lieu de les filtrer pour chaque bloc', () => {
  const MAX_PAR_FAIT = 12 // 60 blocs : filtrer bloc par bloc ferait plus de 60 lectures par fait.

  it('tableau de bord', () => {
    const faits = faitsDesBlocs()
    const { lectures, observes } = lecturesDeBloc(faits)
    composerTableau({
      modules,
      module: undefined,
      periode: undefined,
      blocs,
      faits: observes,
      reglages: REGLAGES,
      maintenant: MAINTENANT,
      controles: [],
      revuesCartes: [],
      mesuresTemps: [],
      derniereRevue: null,
      couts: [],
      aujourdhui: { jour: '2026-06-01', taches: [] },
    })
    expect(lectures.total / faits.length).toBeLessThan(MAX_PAR_FAIT)
  })

  it('journal', () => {
    const faits = faitsDesBlocs()
    const { lectures, observes } = lecturesDeBloc(faits)
    composerJournal({
      modules,
      blocs,
      faits: observes,
      reglages: REGLAGES,
      maintenant: MAINTENANT,
      requete: {},
      notes: [],
      idees: [],
    })
    expect(lectures.total / faits.length).toBeLessThan(MAX_PAR_FAIT)
  })

  it('export en texte', () => {
    const faits = faitsDesBlocs()
    const { lectures, observes } = lecturesDeBloc(faits)
    composerExport({
      blocs,
      faits: observes,
      reglages: REGLAGES,
      tachesReservees: [],
      idees: [],
      derniereRevue: null,
    })
    expect(lectures.total / faits.length).toBeLessThan(MAX_PAR_FAIT)
  })
})
