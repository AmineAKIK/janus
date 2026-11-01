import { describe, expect, it } from 'vitest'
import { RejeuAtelier, RejeuPratique, suivreLAtelier, suivreLaPratique } from './pratique.ts'
import type { CasItem, EssaiPratique } from './pratique.ts'

const JOUR = '2026-11-01'
const LENDEMAIN = '2026-11-02'

let compteur = 0
function r(
  item: string,
  reussi: boolean,
  aide = 0,
  options: { jour?: string; cas?: CasItem | null; brute?: boolean } = {},
): EssaiPratique {
  compteur += 1
  return {
    id: 'r' + String(compteur),
    item,
    reussi,
    aide,
    brute: options.brute ?? true,
    jour: options.jour ?? JOUR,
    cas: options.cas === undefined ? 'origine' : options.cas,
  }
}

const ORDRE = ['A', 'B', 'C']
const suivre = (resultats: EssaiPratique[], jour = JOUR, ordre = ORDRE) =>
  suivreLaPratique(ordre, resultats, jour)
const etat = (resultats: EssaiPratique[], item: string, jour = JOUR, ordre = ORDRE) => {
  const trouve = suivre(resultats, jour, ordre).get(item)
  if (trouve === undefined) throw new Error('item absent : ' + item)
  return trouve
}

describe('RejeuPratique', () => {
  it("ajoute l'aide gardée à une aide brute, le même jour", () => {
    const rejeu = new RejeuPratique()
    expect(rejeu.noter(r('A', true, 2))).toBe(2)
    expect(rejeu.noter(r('A', true, 0))).toBe(2)
    expect(rejeu.aideGardee('A', JOUR)).toBe(2)
  })

  it('garde la plus forte aide reçue', () => {
    const rejeu = new RejeuPratique()
    rejeu.noter(r('A', false, 1))
    expect(rejeu.noter(r('A', false, 3))).toBe(3)
    expect(rejeu.noter(r('A', true, 1))).toBe(3)
  })

  it("lâche l'aide gardée un autre jour", () => {
    const rejeu = new RejeuPratique()
    rejeu.noter(r('A', true, 2))
    expect(rejeu.aideGardee('A', LENDEMAIN)).toBe(0)
    expect(rejeu.noter(r('A', true, 0, { jour: LENDEMAIN }))).toBe(0)
  })

  it("éloigne l'aide des autres items quand un item est réussi, même avec de l'aide", () => {
    const rejeu = new RejeuPratique()
    rejeu.noter(r('A', true, 2))
    rejeu.noter(r('B', true, 1))
    expect(rejeu.aideGardee('A', JOUR)).toBe(0)
    expect(rejeu.aideGardee('B', JOUR)).toBe(1)
  })

  it("n'éloigne rien sur un « Pas réussi »", () => {
    const rejeu = new RejeuPratique()
    rejeu.noter(r('A', true, 2))
    rejeu.noter(r('B', false, 0))
    expect(rejeu.aideGardee('A', JOUR)).toBe(2)
  })

  it("prend l'aide d'un ancien résultat (sans `brute`) telle qu'elle a été notée", () => {
    const rejeu = new RejeuPratique()
    rejeu.noter(r('A', true, 2, { brute: false }))
    // L'ancienne page avait jugé l'aide éloignée : elle a noté 0, l'aide gardée tombe.
    expect(rejeu.noter(r('A', true, 0, { brute: false }))).toBe(0)
    expect(rejeu.aideGardee('A', JOUR)).toBe(0)
  })

  it('repart de zéro quand la fiche est recommencée', () => {
    const rejeu = new RejeuPratique()
    rejeu.noter(r('A', true, 2))
    rejeu.couper()
    expect(rejeu.noter(r('A', true, 0))).toBe(0)
  })
})

describe('suivreLaPratique', () => {
  it('donne chaque item du manifeste, à faire avant tout résultat', () => {
    const etats = suivre([])
    expect([...etats.keys()]).toEqual(ORDRE)
    expect(etats.get('A')).toEqual({
      etat: 'a_faire',
      essais: 0,
      dernier: null,
      aideGardee: 0,
      solutionVue: false,
      refaire: false,
      relais: false,
      marque: false,
      cas: 'origine',
      debloquePar: [],
    })
  })

  it("ignore un résultat d'un item que le manifeste n'a plus, mais il éloigne quand même l'aide", () => {
    const resultats = [r('A', true, 2), r('Z', true, 0)]
    expect(suivre(resultats).has('Z')).toBe(false)
    expect(etat(resultats, 'A').refaire).toBe(true)
  })

  it('réussi sans aide : vert pour de bon, quoi qui suive', () => {
    const resultats = [r('A', true, 0), r('A', false, 0), r('A', true, 4), r('A', false, 4)]
    const a = etat(resultats, 'A')
    expect(a.etat).toBe('reussi')
    expect(a.essais).toBe(4)
    expect(a.dernier).toEqual({ reussi: false, aide: 4 })
  })

  it("réussi avec de l'aide puis raté : il reste réussi avec de l'aide", () => {
    expect(etat([r('A', true, 2), r('A', false, 0)], 'A').etat).toBe('aide')
  })

  it("la séquence d'Amine : l'item 2 aidé, l'item 6 réussi, l'item 2 refait sans aide passe au vert", () => {
    const ordre = ['PR1-6', 'PR1-2', 'PR1-5']
    // L'item 2 réussi après une erreur (aide 1), puis refait tout de suite : l'aide reste.
    const debut = [r('PR1-2', true, 1), r('PR1-2', true, 0)]
    const tot = etat(debut, 'PR1-2', JOUR, ordre)
    expect(tot.etat).toBe('aide')
    expect(tot.dernier).toEqual({ reussi: true, aide: 1 })
    expect(tot.debloquePar).toEqual(['PR1-6', 'PR1-5'])
    // L'item 6 réussi : l'aide de l'item 2 s'éloigne, il se refait sur l'autre cas.
    const apres6 = [...debut, r('PR1-6', true, 0)]
    const deux = etat(apres6, 'PR1-2', JOUR, ordre)
    expect(deux.refaire).toBe(true)
    expect(deux.cas).toBe('variante')
    expect(etat(apres6, 'PR1-6', JOUR, ordre).etat).toBe('reussi')
    // Refait sans aide sur la variante : vert, et l'item 6 le reste.
    const fin = [...apres6, r('PR1-2', true, 0, { cas: 'variante' })]
    expect(etat(fin, 'PR1-2', JOUR, ordre).etat).toBe('reussi')
    expect(etat(fin, 'PR1-6', JOUR, ordre).etat).toBe('reussi')
  })

  it('un item vert refait en relais, même raté ou aidé, reste vert', () => {
    const resultats = [
      r('A', true, 0),
      r('B', true, 0),
      r('C', true, 2),
      r('A', false, 3, { cas: 'variante' }),
    ]
    expect(etat(resultats, 'A').etat).toBe('reussi')
  })

  it('le lendemain, un item aidé se refait sans attendre un autre item', () => {
    const resultats = [r('A', true, 2)]
    expect(etat(resultats, 'A').refaire).toBe(false)
    expect(etat(resultats, 'A', LENDEMAIN).refaire).toBe(true)
    // Refait le lendemain sans aide : il compte.
    const fin = [...resultats, r('A', true, 0, { jour: LENDEMAIN, cas: 'variante' })]
    expect(etat(fin, 'A', LENDEMAIN).etat).toBe('reussi')
  })

  it("un « Pas réussi » d'un autre item n'éloigne pas l'aide", () => {
    const a = etat([r('A', true, 2), r('B', false, 0)], 'A')
    expect(a.refaire).toBe(false)
    expect(a.aideGardee).toBe(2)
  })

  it('nomme les items à réussir : ceux pas encore réussis, et ceux à refaire', () => {
    const resultats = [r('C', true, 1), r('B', true, 0), r('A', true, 2)]
    // C est à refaire (B l'a éloigné), B est vert : seul C débloque A.
    expect(etat(resultats, 'A').debloquePar).toEqual(['C'])
    expect(etat(resultats, 'A').relais).toBe(false)
  })

  it("le relais : plus rien d'autre à réussir, les items verts se rouvrent sur leur autre cas", () => {
    const resultats = [r('A', true, 0), r('B', true, 0, { cas: 'variante' }), r('C', true, 2)]
    const c = etat(resultats, 'C')
    expect(c.debloquePar).toEqual(['A', 'B'])
    const a = etat(resultats, 'A')
    expect(a.relais).toBe(true)
    expect(a.marque).toBe(true)
    expect(a.cas).toBe('variante')
    expect(etat(resultats, 'B').cas).toBe('origine')
    // A réussi en relais : l'aide de C s'éloigne, C se refait, et le relais s'arrête.
    const fin = [...resultats, r('A', true, 0, { cas: 'variante' })]
    expect(etat(fin, 'C').refaire).toBe(true)
    expect(etat(fin, 'A').relais).toBe(false)
    expect(etat(fin, 'A').etat).toBe('reussi')
  })

  it('pas de relais pour un item dont un autre item peut encore éloigner l’aide', () => {
    const resultats = [r('A', true, 0), r('C', true, 2)]
    expect(etat(resultats, 'A').relais).toBe(false)
    expect(etat(resultats, 'C').debloquePar).toEqual(['B'])
  })

  it("solution vue : l'item se refait sur l'autre cas, et y reste tant qu'il n'est pas réussi", () => {
    const vu = [r('A', false, 4)]
    const a = etat(vu, 'A')
    expect(a.solutionVue).toBe(true)
    expect(a.marque).toBe(true)
    expect(a.cas).toBe('variante')
    expect(a.aideGardee).toBe(4)
    // Raté sur la variante, l'aide 4 toujours gardée : il reste sur la variante.
    const rate = [...vu, r('A', false, 0, { cas: 'variante' })]
    expect(etat(rate, 'A').cas).toBe('variante')
    expect(etat(rate, 'A').dernier).toEqual({ reussi: false, aide: 4 })
    // La solution de la variante montrée à son tour : retour au cas d'origine.
    const revu = [...rate, r('A', false, 4, { cas: 'variante' })]
    expect(etat(revu, 'A').cas).toBe('origine')
    // Réussi avec l'aide gardée : il revient sur le cas réussi, avec sa réponse.
    const reussi = [...revu, r('A', true, 0)]
    expect(etat(reussi, 'A').solutionVue).toBe(false)
    expect(etat(reussi, 'A').etat).toBe('aide')
    expect(etat(reussi, 'A').cas).toBe('origine')
    expect(etat(reussi, 'A').marque).toBe(true)
  })

  it("à refaire : sur l'autre cas que le dernier fait avec de l'aide, même après un échec", () => {
    const aide = [r('A', true, 2, { cas: 'variante' }), r('B', true, 0)]
    expect(etat(aide, 'A').cas).toBe('origine')
    const rate = [...aide, r('A', false, 0)]
    expect(etat(rate, 'A').refaire).toBe(true)
    expect(etat(rate, 'A').cas).toBe('origine')
  })

  it('un résultat sans cas compte pour le cas d’origine', () => {
    expect(etat([r('A', true, 0, { cas: null })], 'A').cas).toBe('origine')
  })

  it("un item réussi sans aide ne nomme aucun item, même s'il garde une aide", () => {
    expect(etat([r('A', true, 0), r('A', false, 2)], 'A').debloquePar).toEqual([])
  })
})

describe('suivreLAtelier', () => {
  let numero = 0
  const constat = (reussi: boolean, aide: number, jour = JOUR) => {
    numero += 1
    return { id: 'a' + String(numero), reussi, aide, jour }
  }

  it('rien avant le premier constat', () => {
    expect(suivreLAtelier([], JOUR)).toEqual({ reussi: false, dernier: null, aideGardee: 0 })
  })

  it('réussi sans aide : il compte', () => {
    expect(suivreLAtelier([constat(true, 0)], JOUR).reussi).toBe(true)
  })

  it("le même jour, un constat part avec l'aide déjà déclarée", () => {
    const etat = suivreLAtelier([constat(true, 2), constat(true, 0)], JOUR)
    expect(etat.reussi).toBe(false)
    expect(etat.dernier).toEqual({ reussi: true, aide: 2 })
    expect(etat.aideGardee).toBe(2)
  })

  it("un autre jour, l'atelier refait sans aide compte : il se rattrape", () => {
    const aide = [constat(true, 4)]
    expect(suivreLAtelier(aide, LENDEMAIN).aideGardee).toBe(0)
    const etat = suivreLAtelier([...aide, constat(true, 0, LENDEMAIN)], LENDEMAIN)
    expect(etat.reussi).toBe(true)
    expect(etat.dernier).toEqual({ reussi: true, aide: 0 })
  })

  it('réussi sans aide, il le reste, même raté ou aidé ensuite', () => {
    const etat = suivreLAtelier([constat(true, 0), constat(false, 3)], JOUR)
    expect(etat.reussi).toBe(true)
    expect(etat.dernier).toEqual({ reussi: false, aide: 3 })
  })

  it('garde la plus forte aide du jour', () => {
    const rejeu = new RejeuAtelier()
    rejeu.noter(constat(false, 3))
    expect(rejeu.noter(constat(false, 1))).toBe(3)
    expect(rejeu.aideGardee(JOUR)).toBe(3)
    expect(rejeu.aideGardee(LENDEMAIN)).toBe(0)
  })
})
