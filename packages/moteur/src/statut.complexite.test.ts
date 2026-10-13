import { describe, expect, it } from 'vitest'
import { apres, DEBUT, fabrique, MANIFESTE, REGLAGES } from './fabrique.ts'
import type { Fait } from './faits.ts'
import { calculerBloc } from './statut.ts'

const MAINTENANT = apres(DEBUT, 800)

/** Des faits dont chaque lecture de champ est comptée : une mesure du travail, indépendante de la machine. */
function compteurs(faits: readonly Fait[]) {
  const lectures = { total: 0 }
  const observes = faits.map(
    (fait) =>
      new Proxy(fait, {
        get(cible, propriete, destinataire) {
          lectures.total += 1
          const valeur: unknown = Reflect.get(cible, propriete, destinataire)
          return valeur
        },
      }),
  )
  return { lectures, observes }
}

/** Un bloc long : beaucoup de réponses de restitution et de consolidation, de tranchages et d'erreurs. */
function blocLong(taille: number): Fait[] {
  const f = fabrique()
  const faits: Fait[] = []
  let minute = 0
  const date = () => apres(DEBUT, 0, (minute += 7))
  const corrections: Fait[] = []
  while (faits.length < taille) {
    const rang = faits.length
    const serie = rang % 3 === 0 ? 'restitution' : 'consolidation'
    const questions = serie === 'restitution' ? MANIFESTE.restitution : MANIFESTE.consolidation
    const question = questions[rang % questions.length]?.id ?? 'R1'
    const correction = f.correction(date(), serie, question, {
      niveau: rang % 5 === 0 ? 'partiel' : 'solide',
    })
    corrections.push(correction)
    faits.push(correction)
    if (rang % 10 === 4) {
      faits.push(
        f.fait(date(), {
          type: 'correction_tranchee',
          correction: correction.id,
          compte: rang % 20 !== 4,
          niveau: 'fragile',
        }),
      )
    }
    if (rang % 12 === 6) faits.push(f.cochee(date(), 'E1'))
    if (rang % 12 === 9) faits.push(f.etape(date(), 'ET3'))
  }
  return faits
}

function lectures(taille: number): number {
  const { lectures: mesure, observes } = compteurs(blocLong(taille))
  calculerBloc(observes, MANIFESTE, REGLAGES, MAINTENANT)
  return mesure.total
}

describe('calculerBloc : le travail croît avec le nombre de faits, pas avec son carré', () => {
  it('lit à peu près deux fois plus de champs pour deux fois plus de faits', () => {
    const petit = lectures(1000)
    const grand = lectures(2000)
    // Linéaire (avec le tri) : ~2,1. Quadratique : ~4.
    expect(grand / petit).toBeLessThan(3)
  })
})
