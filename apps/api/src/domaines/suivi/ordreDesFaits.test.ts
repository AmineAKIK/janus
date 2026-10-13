import { Reglages } from '@janus/contrats'
import type { Fait, TypeJournal } from '@janus/contrats'
import { composerExport, composerJournal } from '@janus/moteur'
import type { BlocImporte } from '@janus/moteur'
import { CAS_ACCEPTATION } from '@janus/moteur/cas-acceptation'
import type { CasStatut } from '@janus/moteur/cas-acceptation'
import { describe, expect, it } from 'vitest'

// Le journal et l'export texte lisent les faits depuis les états gardés par bloc : rangés par bloc, et non
// plus dans l'ordre des tables. Ce qu'ils en tirent ne doit pas dépendre de cet ordre.
// (Le tableau de bord, lui, en dépend : la liste des erreurs sûres de sa calibration suit l'ordre d'arrivée
// des faits. Il continue donc de lire les faits dans l'ordre des tables.)

const CAS = CAS_ACCEPTATION.filter((cas): cas is CasStatut => cas.genre === 'statut')
const REGLAGES = Reglages.parse({})
const TYPES: (TypeJournal | undefined)[] = [undefined, 'verification', 'restitution']

/** Un générateur déterministe, pour des mélanges qu'on peut rejouer. */
function generateur(graine: number): () => number {
  let etat = graine >>> 0
  return () => {
    etat = (Math.imul(etat, 1_664_525) + 1_013_904_223) >>> 0
    return etat / 4_294_967_296
  }
}

function melanger<T>(elements: readonly T[], graine: number): T[] {
  const hasard = generateur(graine)
  const copie = [...elements]
  for (let i = copie.length - 1; i > 0; i -= 1) {
    const j = Math.floor(hasard() * (i + 1))
    const a = copie[i]
    const b = copie[j]
    if (a !== undefined && b !== undefined) {
      copie[i] = b
      copie[j] = a
    }
  }
  return copie
}

/** Les faits rangés par bloc (dans l'ordre d'arrivée au sein d'un bloc), comme les états gardés les rendent. */
function parBloc(faits: readonly Fait[], ordreDesBlocs: readonly string[]): Fait[] {
  return ordreDesBlocs.flatMap((code) => faits.filter(({ bloc }) => bloc === code))
}

function sorties(blocs: readonly BlocImporte[], faits: readonly Fait[], maintenant: string) {
  const modules = [...new Set(blocs.map(({ moduleCode }) => moduleCode))].map((id) => ({
    id,
    titre: id,
  }))
  const commun = { modules, blocs, faits, reglages: REGLAGES, maintenant }
  return {
    journal: TYPES.map((type) =>
      composerJournal({
        ...commun,
        requete: { type },
        notes: [],
        idees: [],
      }),
    ),
    export: composerExport({
      blocs,
      faits,
      reglages: REGLAGES,
      tachesReservees: [],
      idees: [],
      derniereRevue: null,
    }),
  }
}

describe("l'ordre des faits donnés au journal et à l'export texte est sans effet", () => {
  for (const cas of CAS) {
    it(`cas « ${cas.situation} » : à l'envers, mélangé, rangé par bloc`, () => {
      const blocs: BlocImporte[] = [
        { code: cas.manifeste.bloc, moduleCode: 'M1', partie: 'P1', manifeste: cas.manifeste },
      ]
      const reference = sorties(blocs, cas.faits, cas.maintenant)
      for (const ordre of [
        [...cas.faits].reverse(),
        melanger(cas.faits, 1),
        melanger(cas.faits, 2),
        parBloc(cas.faits, [cas.manifeste.bloc]),
      ]) {
        expect(sorties(blocs, ordre, cas.maintenant)).toEqual(reference)
      }
    })
  }

  it('plusieurs blocs ensemble : rangés par bloc ou mélangés, la même sortie', () => {
    const vus = new Set<string>()
    const retenus = CAS.filter((cas) => {
      if (vus.has(cas.manifeste.bloc)) return false
      vus.add(cas.manifeste.bloc)
      return true
    })
    const blocs: BlocImporte[] = retenus.map((cas) => ({
      code: cas.manifeste.bloc,
      moduleCode: 'M1',
      partie: 'P1',
      manifeste: cas.manifeste,
    }))
    // Un identifiant ne sert qu'à un cas : sinon deux faits de blocs différents partageraient le leur.
    const faits = retenus.flatMap((cas, rang) =>
      cas.faits.map((fait): Fait => ({
        ...fait,
        id: `${String(rang)}-${fait.id}`,
        ...('correction' in fait ? { correction: `${String(rang)}-${fait.correction}` } : {}),
      })),
    )
    const maintenant = '2027-01-15T10:00:00.000Z'
    const reference = sorties(blocs, faits, maintenant)
    const codes = blocs.map(({ code }) => code)
    for (const ordre of [
      parBloc(faits, codes),
      parBloc(faits, [...codes].reverse()),
      melanger(faits, 3),
      melanger(faits, 4),
    ]) {
      expect(sorties(blocs, ordre, maintenant)).toEqual(reference)
    }
  })
})
