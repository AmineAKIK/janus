import { nouvelId } from '@janus/contrats'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { formationActiveDe } from './formationActive.ts'
import * as t from './schema/index.ts'
import { creerBaseDeTest, URL_SERVEUR_TEST } from './testeurBase.ts'

describe.skipIf(URL_SERVEUR_TEST === undefined)('formation active', () => {
  let base: Awaited<ReturnType<typeof creerBaseDeTest>>
  const ids = { dev: nouvelId(1_000), tech: nouvelId(2_000), vide: nouvelId(3_000) }

  beforeAll(async () => {
    base = await creerBaseDeTest(URL_SERVEUR_TEST ?? '')
  })
  afterAll(async () => {
    await base.supprimer()
  })

  it('rend null tant qu’aucun module n’est importé', async () => {
    expect(await formationActiveDe(base.db, null)).toBeNull()
  })

  it('suit le choix, sinon la première formation importée, et ignore une formation sans module importé', async () => {
    await base.db.insert(t.formations).values([
      { id: ids.dev, code: 'DEV', titre: 'Développeur' },
      { id: ids.tech, code: 'TECH', titre: 'Technicien' },
      { id: ids.vide, code: 'AAA', titre: 'Pas importée' },
    ])
    await base.db.insert(t.modules).values([
      {
        id: nouvelId(4_000),
        formationId: ids.dev,
        code: 'M1',
        titre: 'M1',
        ordre: 1,
        importe: true,
      },
      {
        id: nouvelId(5_000),
        formationId: ids.tech,
        code: 'M1',
        titre: 'M1',
        ordre: 1,
        importe: true,
      },
      {
        id: nouvelId(6_000),
        formationId: ids.vide,
        code: 'M1',
        titre: 'M1',
        ordre: 1,
        importe: false,
      },
    ])

    expect(await formationActiveDe(base.db, null)).toBe(ids.dev)
    expect(await formationActiveDe(base.db, ids.tech)).toBe(ids.tech)
    expect(await formationActiveDe(base.db, ids.vide)).toBe(ids.dev)
    expect(await formationActiveDe(base.db, nouvelId(9_000))).toBe(ids.dev)
  })
})
