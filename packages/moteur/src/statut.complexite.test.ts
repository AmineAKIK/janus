import { describe, expect, it } from 'vitest'
import { apres, blocLong, DEBUT, MANIFESTE, REGLAGES } from './fabrique.ts'
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
