import { Reglages, validerManifeste } from '@janus/contrats'
import type { Statut } from '@janus/contrats'
import { accesBloc, calculerBloc, jourDe } from '@janus/moteur'
import { describe, expect, it } from 'vitest'
import {
  catalogueGraine,
  ERREUR_COMPILATEUR,
  etatGraine,
  faitsGraine,
  MANIFESTES_GRAINE,
  PLAN,
} from './graine.ts'

const REGLAGES = Reglages.parse({})

/** Des premiers lancements variés : été, hiver, avant et après la bascule de 4 h, changements d'heure. */
const LANCEMENTS = [
  '2026-10-05T23:00:00Z',
  '2026-10-05T02:30:00Z',
  '2026-10-25T00:30:00Z',
  '2026-10-26T03:30:00Z',
  '2026-03-29T01:30:00Z',
  '2026-06-01T10:00:00Z',
  '2027-01-15T04:00:00Z',
]

function statuts(maintenant: string) {
  const faits = faitsGraine(maintenant)
  return Object.fromEntries(
    PLAN.map(({ code }) => {
      const manifeste = MANIFESTES_GRAINE[code]
      if (manifeste === undefined) throw new Error(`Manifeste manquant pour ${code}`)
      return [
        code,
        calculerBloc(
          faits.filter((fait) => fait.bloc === code),
          manifeste,
          REGLAGES,
          maintenant,
        ),
      ]
    }),
  )
}

const ATTENDUS: Record<string, Statut> = {
  B01: 'acquis',
  B02: 'acquis_provisoirement',
  B03: 'en_cours',
  B04: 'a_reprendre',
  B05: 'vu',
  B06: 'acquis',
  B07: 'acquis_provisoirement',
}
// B08 à B20 : rien n'est commencé.
for (let i = 8; i <= 20; i += 1) ATTENDUS[`B${String(i).padStart(2, '0')}`] = 'non_commence'

describe('le plan', () => {
  it('a 20 blocs, de B01 à B20, avec les prérequis de la liste', () => {
    expect(PLAN.map(({ code }) => code)).toEqual(
      Array.from({ length: 20 }, (_, i) => `B${String(i + 1).padStart(2, '0')}`),
    )
    expect(PLAN.find(({ code }) => code === 'B20')?.prerequis).toEqual([
      'B02',
      'B10',
      'B11',
      'B12',
      'B13',
      'B14',
      'B15',
      'B16',
    ])
    expect(PLAN.find(({ code }) => code === 'B12')?.prerequis).toEqual(['B04', 'B07', 'B09', 'B10'])
  })

  it('range les blocs dans les cinq parties du catalogue', () => {
    const [module1, ...autres] = catalogueGraine().modules

    expect(catalogueGraine().formation.code).toBe('DWWM')
    expect(
      module1?.importe && module1.parties.map(({ code, blocs }) => [code, blocs.length]),
    ).toEqual([
      ['P1', 4],
      ['P2', 3],
      ['P3', 6],
      ['P4', 4],
      ['P5', 3],
    ])
    expect(autres.every(({ importe }) => !importe)).toBe(true)
    expect(autres.length).toBeGreaterThanOrEqual(2)
  })

  it('donne un manifeste valide par bloc, cloné du manifeste de démonstration', () => {
    for (const { code, titre, prerequis } of PLAN) {
      const manifeste = MANIFESTES_GRAINE[code]

      expect(manifeste).toMatchObject({ bloc: code, titre, titre_court: titre, prerequis })
      expect(validerManifeste(manifeste)).toMatchObject({ ok: true })
    }
  })

  it('ajoute l’erreur critique « confond compilateur et interpréteur » à B04 seulement', () => {
    const erreursDe = (code: string) =>
      MANIFESTES_GRAINE[code]?.erreurs_critiques.map(({ id }) => id) ?? []

    expect(erreursDe('B04')).toContain(ERREUR_COMPILATEUR)
    expect(erreursDe('B03')).not.toContain(ERREUR_COMPILATEUR)
  })
})

describe.each(LANCEMENTS)('la graine d’un premier lancement à %s', (maintenant) => {
  const resultats = statuts(maintenant)

  it('produit exactement les statuts du jeu d’exemple', () => {
    const obtenus = Object.fromEntries(Object.entries(resultats).map(([k, v]) => [k, v.statut]))

    expect(obtenus).toEqual(ATTENDUS)
  })

  it('ne force aucun statut : ils sortent tous des faits', () => {
    expect(Object.values(resultats).every(({ force }) => force === null)).toBe(true)
  })

  it('dit que la vérification de B02 est due aujourd’hui et celle de B07 à venir', () => {
    const aujourdhui = jourDe(maintenant, REGLAGES.fuseau, REGLAGES.heureBascule)

    expect(resultats['B02']?.manque).toContainEqual({
      code: 'verification_a_faire',
      apres: aujourdhui,
    })
    expect(resultats['B07']?.manque.map(({ code }) => code)).toContain('verification_a_venir')
  })

  it('ouvre B04 avec l’erreur critique cochée', () => {
    expect(resultats['B04']?.erreursOuvertes).toEqual([ERREUR_COMPILATEUR])
  })

  it('ouvre B07 sans que ses prérequis soient acquis, en donnant une raison', () => {
    const faits = faitsGraine(maintenant)
    const statutsPrerequis = (MANIFESTES_GRAINE['B07']?.prerequis ?? []).map(
      (code) => resultats[code]?.statut ?? 'non_commence',
    )
    const ouverture = faits.find((fait) => fait.bloc === 'B07' && fait.type === 'bloc_ouvert')

    expect(accesBloc(statutsPrerequis)).toBe('raison_requise')
    expect(ouverture).toMatchObject({ horsPrerequis: true })
    expect(ouverture?.type === 'bloc_ouvert' && ouverture.raison).toBeTruthy()
  })

  it('date tous les faits avant le premier lancement, sans identifiant en double', () => {
    const faits = faitsGraine(maintenant)

    expect(faits.every(({ date }) => date <= maintenant)).toBe(true)
    expect(new Set(faits.map(({ id }) => id)).size).toBe(faits.length)
  })
})

describe('etatGraine', () => {
  it('range les faits dans un état de démo valide, session fermée', () => {
    const etat = etatGraine('2026-10-05T23:00:00Z')

    expect(etat.premierLancement).toBe('2026-10-05T23:00:00Z')
    expect(etat.sessionOuverte).toBe(false)
    expect(etat.faits).toEqual(faitsGraine('2026-10-05T23:00:00Z'))
  })
})
