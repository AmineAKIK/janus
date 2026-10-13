import { Manifeste, Reglages } from '@janus/contrats'
import type { Fait } from '@janus/contrats'
import { auMoinsVu, blocEnCours, calculerBloc, jourDe } from '@janus/moteur'
import { CAS_ACCEPTATION } from '@janus/moteur/cas-acceptation'
import type { CasStatut } from '@janus/moteur/cas-acceptation'
import { describe, expect, it } from 'vitest'
import { contexteDuJour } from './policy.ts'
import type { BlocDuPlan, ContexteDuJour } from './policy.ts'

/** Le calcul tel qu'il était avant le regroupement des faits par bloc : un filtre complet par bloc du plan. */
function contexteDeReference(
  plan: readonly BlocDuPlan[],
  faits: readonly Fait[],
  reglages: Reglages,
  maintenant: string,
): ContexteDuJour {
  const blocs = plan.map(({ code, moduleId, manifeste }) => {
    const lu = Manifeste.parse(manifeste)
    const duBloc = faits.filter((fait) => fait.bloc === code)
    return {
      manifeste: lu,
      moduleId,
      etat: calculerBloc(duBloc, lu, reglages, maintenant),
      dernierFait: duBloc.reduce<string | null>(
        (dernier, fait) => (dernier === null || fait.date > dernier ? fait.date : dernier),
        null,
      ),
    }
  })
  const derniereActivite = blocs.reduce<string | null>(
    (dernier, { dernierFait }) =>
      dernierFait !== null && (dernier === null || dernierFait > dernier) ? dernierFait : dernier,
    null,
  )
  const enCours = blocEnCours(
    blocs.map(({ manifeste, etat, dernierFait }) => ({
      bloc: manifeste.bloc,
      statut: etat.statut,
      dernierFait,
    })),
  )
  return {
    blocs,
    vus: blocs.filter(({ etat }) => auMoinsVu(etat)),
    derniereActivite,
    enCours,
    jour: jourDe(maintenant, reglages.fuseau, reglages.heureBascule),
  }
}

const CAS = CAS_ACCEPTATION.filter((cas): cas is CasStatut => cas.genre === 'statut')

/** Un plan d'un bloc par cas d'acceptation, chacun avec les faits du cas ; plus un bloc sans fait. */
function jeu() {
  const plan: BlocDuPlan[] = []
  const faits: Fait[] = []
  for (const [rang, cas] of CAS.entries()) {
    const code = `B${String(rang + 1).padStart(3, '0')}`
    plan.push({
      id: `id-${code}`,
      code,
      moduleId: rang % 2 === 0 ? 'm1' : 'm2',
      moduleCode: rang % 2 === 0 ? 'M1' : 'M2',
      moduleTitre: 'Module',
      manifeste: { ...cas.manifeste, bloc: code },
    })
    faits.push(...cas.faits.map((fait) => ({ ...fait, bloc: code })))
  }
  plan.push({
    id: 'id-bv99',
    code: 'BV99',
    moduleId: 'm2',
    moduleCode: 'M2',
    moduleTitre: 'Module',
    manifeste: { ...(CAS[0]?.manifeste ?? {}), bloc: 'BV99' },
  })
  return { plan, faits, reglages: Reglages.parse({}) }
}

describe('contexteDuJour', () => {
  it('rend ce que rendait le filtre des faits bloc par bloc, sur les cas d’acceptation du cadrage', () => {
    const { plan, faits, reglages } = jeu()
    expect(CAS.length).toBeGreaterThan(10)

    for (const maintenant of [
      '2026-06-01T12:00:00.000Z',
      '2026-06-20T09:00:00.000Z',
      '2027-01-01T00:00:00.000Z',
    ]) {
      expect(contexteDuJour(plan, faits, reglages, maintenant)).toEqual(
        contexteDeReference(plan, faits, reglages, maintenant),
      )
    }
  })

  it('ne tient pas compte des faits d’un bloc qui n’est pas au plan, ni de leur ordre d’arrivée', () => {
    const { plan, faits, reglages } = jeu()
    const etrangers = faits
      .slice(0, 5)
      .map((fait) => ({ ...fait, id: `e-${fait.id}`, bloc: 'AILLEURS' }))
    const melanges = [...etrangers, ...[...faits].reverse(), ...etrangers]
    const maintenant = '2026-06-20T09:00:00.000Z'

    expect(contexteDuJour(plan, melanges, reglages, maintenant)).toEqual(
      contexteDeReference(plan, melanges, reglages, maintenant),
    )
  })

  it('ne dépend pas de la place des faits : un bloc sans fait est non commencé, sans dernier fait', () => {
    const { plan, faits, reglages } = jeu()
    const contexte = contexteDuJour(plan, faits, reglages, '2026-06-20T09:00:00.000Z')
    const vide = contexte.blocs.find(({ manifeste }) => manifeste.bloc === 'BV99')

    expect(vide?.dernierFait).toBeNull()
    expect(vide?.etat.statut).toBe('non_commence')
  })
})
