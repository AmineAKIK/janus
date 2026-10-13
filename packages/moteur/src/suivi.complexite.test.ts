import { describe, expect, it } from 'vitest'
import { apres, blocLong, DEBUT, MANIFESTE, REGLAGES } from './fabrique.ts'
import type { Fait } from './faits.ts'
import { composerTableau } from './composition/tableau.ts'
import { revueMethode } from './indicateurs/revue.ts'
import { exportTexte } from './journal/exportTexte.ts'
import { lignesDuJournal } from './journal/lignes.ts'

const MAINTENANT = apres(DEBUT, 5000)

/** Compte les lectures de champs des faits : une mesure du travail, indépendante de la machine. */
function lectures(faits: readonly Fait[], lire: (observes: readonly Fait[]) => unknown): number {
  const compte = { total: 0 }
  const observes = faits.map(
    (fait) =>
      new Proxy(fait, {
        get(cible, propriete, destinataire) {
          compte.total += 1
          const valeur: unknown = Reflect.get(cible, propriete, destinataire)
          return valeur
        },
      }),
  )
  lire(observes)
  return compte.total
}

/**
 * Deux fois plus de faits doivent coûter à peu près deux fois plus de lectures. Linéaire (avec les tris) :
 * ~2,1. Quadratique, comme quand chaque fait relance le calcul du statut sur tous ses prédécesseurs : ~4.
 */
function croissance(
  faits: (taille: number) => Fait[],
  lire: (observes: readonly Fait[]) => unknown,
): number {
  return lectures(faits(2000), lire) / lectures(faits(1000), lire)
}

const SEUIL = 3
// Les réponses de restitution et de consolidation sont rarement tranchées après coup.
const sansTranchage = (taille: number) => blocLong(taille, { periodeTranchage: Infinity })

describe('le statut après chaque fait ne relance pas le calcul sur tous les faits précédents', () => {
  it('lignesDuJournal', () => {
    const ratio = croissance(sansTranchage, (faits) =>
      lignesDuJournal(faits, {
        manifestes: { [MANIFESTE.bloc]: MANIFESTE },
        reglages: REGLAGES,
      }),
    )
    expect(ratio).toBeLessThan(SEUIL)
  })

  it('revueMethode', () => {
    const ratio = croissance(sansTranchage, (faits) =>
      revueMethode(faits, [], [MANIFESTE], null, REGLAGES),
    )
    expect(ratio).toBeLessThan(SEUIL)
  })

  it("l'export en texte, avec un jour par fait", () => {
    const ratio = croissance(
      (taille) => blocLong(taille, { periodeTranchage: Infinity, pasMinutes: 1440 }),
      (faits) =>
        exportTexte({
          manifestes: [MANIFESTE],
          faits,
          reglages: REGLAGES,
          tachesReservees: [],
          idees: [],
          derniereRevue: null,
        }),
    )
    expect(ratio).toBeLessThan(SEUIL)
  })

  it('le tableau de bord, qui passe par la revue de méthode', () => {
    const ratio = croissance(sansTranchage, (faits) =>
      composerTableau({
        modules: [{ id: 'M1', titre: 'Module' }],
        module: undefined,
        periode: undefined,
        blocs: [
          { code: MANIFESTE.bloc, moduleCode: 'M1', partie: '1.1 Partie', manifeste: MANIFESTE },
        ],
        faits,
        reglages: REGLAGES,
        maintenant: MAINTENANT,
        controles: [],
        revuesCartes: [],
        mesuresTemps: [],
        derniereRevue: null,
        couts: [],
        aujourdhui: { jour: '2026-06-01', taches: [] },
      }),
    )
    expect(ratio).toBeLessThan(SEUIL)
  })
})
