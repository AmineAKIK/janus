import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { baseDepuisPool } from './base/base.ts'
import { creerBaseDeTest, URL_SERVEUR_TEST } from './base/testeurBase.ts'
import { importerLesCatalogues } from './contenu.ts'
import { horlogeFausse } from './testeur.ts'

describe.skipIf(URL_SERVEUR_TEST === undefined)('import des catalogues au démarrage', () => {
  let bases: Awaited<ReturnType<typeof creerBaseDeTest>>
  beforeAll(async () => {
    bases = await creerBaseDeTest(URL_SERVEUR_TEST ?? '')
  })
  afterAll(async () => {
    await bases.supprimer()
  })

  const modules = async () => {
    const { rows } = await bases.pool.query<{ formation: string; titre: string; importe: boolean }>(
      `SELECT f.code AS formation, m.titre, m.importe
         FROM modules m JOIN formations f ON f.id = m.formation_id ORDER BY f.code, m.ordre`,
    )
    return rows
  }

  it('publie la formation DWWM du dépôt, et le relancer ne change rien', async () => {
    const base = baseDepuisPool(bases.db, bases.pool)

    const premier = await importerLesCatalogues(base, horlogeFausse(), '/inutilise')
    const attendu = [
      { formation: 'DWWM', titre: 'Écosystème et outils du développeur', importe: true },
    ]
    expect(premier).toHaveLength(1)
    expect(await modules()).toEqual(attendu)

    await importerLesCatalogues(base, horlogeFausse(), '/inutilise')
    expect(await modules()).toEqual(attendu)
  })
})
