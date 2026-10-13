import { nouvelId } from '@janus/contrats'
import { z } from 'zod'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { baseDepuisPool } from '../../base/base.ts'
import { creerCacheDesEtats } from '../../base/etatsDesBlocs.ts'
import * as t from '../../base/schema/index.ts'
import { creerBaseDeTest, URL_SERVEUR_TEST } from '../../base/testeurBase.ts'
import { semerPlan } from '../../base/testeurPlan.ts'
import type { PlanSeme } from '../../base/testeurPlan.ts'
import { horlogeFausse } from '../../testeur.ts'
import { creerDepotSuivi } from './depot.ts'
import { creerServiceSuivi } from './service.ts'

const MAINTENANT = '2026-10-05T10:00:00.000Z'
const LIGNES = 2_500

describe.skipIf(URL_SERVEUR_TEST === undefined)('export.json en flux contre PostgreSQL', () => {
  let bases: Awaited<ReturnType<typeof creerBaseDeTest>>
  let plan: PlanSeme
  let service: ReturnType<typeof creerServiceSuivi>
  const depot = creerDepotSuivi()

  beforeAll(async () => {
    bases = await creerBaseDeTest(URL_SERVEUR_TEST ?? '')
    plan = await semerPlan(bases.db, ['B01', 'B02'])
    const bloc = plan.blocs[0]
    if (bloc === undefined) throw new Error('Plan vide')
    for (let debut = 0; debut < LIGNES; debut += 500) {
      await bases.db.insert(t.evenements).values(
        Array.from({ length: 500 }, (_, rang) => ({
          id: plan.identifiant(),
          userId: plan.userId,
          blocId: bloc.id,
          ficheVersionId: bloc.versionId,
          type: 'bloc_ouvert' as const,
          donnees: { horsPrerequis: false, texte: `ligne "${String(debut + rang)}" \\ é\n` },
          empreinte: 'e'.repeat(64),
          aide: null,
          dateServeur: `2026-09-${String(10 + (rang % 15))}T10:00:00.000Z`,
        })),
      )
    }
    await bases.db.insert(t.idees).values({
      id: nouvelId(Date.parse(MAINTENANT)),
      userId: plan.userId,
      texte: 'Une idée avec des caractères   spéciaux',
      dateServeur: MAINTENANT,
    })
    service = creerServiceSuivi({
      base: baseDepuisPool(bases.db, bases.pool),
      depot,
      horloge: horlogeFausse(MAINTENANT),
      aujourdhui: () => Promise.reject(new Error('inutilisé')),
      etats: creerCacheDesEtats(),
    })
  })
  afterAll(async () => {
    await bases.supprimer()
  })

  it('arrive en plusieurs morceaux dont la somme est exactement le JSON de toutes les données', async () => {
    const flux = await service.exportJson(plan.userId)
    const morceaux: string[] = []
    for await (const morceau of flux) morceaux.push(String(morceau))

    expect(morceaux.length).toBeGreaterThan(3)
    expect(Math.max(...morceaux.map((m) => m.length))).toBeLessThan(2_000_000)
    const attendu = JSON.stringify({
      version: 1,
      genere_le: MAINTENANT,
      donnees: await depot.donneesDe(bases.db, plan.userId),
    })
    expect(morceaux.join('')).toBe(attendu)
    const lu = z
      .object({ donnees: z.object({ evenements: z.array(z.unknown()) }) })
      .parse(JSON.parse(morceaux.join('')))
    expect(lu.donnees.evenements).toHaveLength(LIGNES)
  })
})
