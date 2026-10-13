import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
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
      { formation: 'DWWM', titre: 'Écosystème et outils du développeur', importe: false },
    ]
    expect(premier).toHaveLength(1)
    expect(await modules()).toEqual(attendu)

    await importerLesCatalogues(base, horlogeFausse(), '/inutilise')
    expect(await modules()).toEqual(attendu)
  })

  describe('fiches du dépôt', () => {
    const FICHE_DEMO = join(
      dirname(fileURLToPath(import.meta.url)),
      '../../web/public/fiches/demo/fiche-demo.html',
    )
    const catalogue = {
      formation: { code: 'ESSAI', titre: 'Essai', description: '' },
      modules: [
        {
          code: 'M1',
          titre: 'Module',
          description: '',
          ordre: 1,
          importe: true,
          parties: [{ code: 'P1', titre: 'Partie', blocs: ['D01'] }],
        },
      ],
    }
    let contenu: string
    let fiches: string
    beforeAll(async () => {
      contenu = await mkdtemp(join(tmpdir(), 'janus-contenu-'))
      fiches = await mkdtemp(join(tmpdir(), 'janus-servies-'))
      await mkdir(join(contenu, 'essai', 'fiches'), { recursive: true })
      await writeFile(join(contenu, 'essai', 'catalogue.json'), JSON.stringify(catalogue))
      await cp(FICHE_DEMO, join(contenu, 'essai', 'fiches', 'D01.html'))
    })
    afterAll(async () => {
      await rm(contenu, { recursive: true, force: true })
      await rm(fiches, { recursive: true, force: true })
    })

    const versions = async () => {
      const { rows } = await bases.pool.query<{ code: string; version: number }>(
        `SELECT b.code, v.version FROM fiches_versions v JOIN blocs b ON b.id = v.bloc_id ORDER BY b.code, v.version`,
      )
      return rows
    }

    it('importe la fiche après le catalogue, puis la rend déjà importée au redémarrage', async () => {
      const base = baseDepuisPool(bases.db, bases.pool)

      const premier = await importerLesCatalogues(base, horlogeFausse(), fiches, contenu)
      expect(premier.at(-1)).toBe('Fiche essai/fiches/D01.html : D01 version 1 importée.')
      expect(await versions()).toEqual([{ code: 'D01', version: 1 }])

      const second = await importerLesCatalogues(base, horlogeFausse(), fiches, contenu)
      expect(second.at(-1)).toBe('Fiche essai/fiches/D01.html : D01 version 1 déjà importée.')
      expect(await versions()).toEqual([{ code: 'D01', version: 1 }])
    })

    it('arrête le démarrage quand le contenu change sans que la version change', async () => {
      const base = baseDepuisPool(bases.db, bases.pool)
      const chemin = join(contenu, 'essai', 'fiches', 'D01.html')
      await writeFile(
        chemin,
        (await readFile(chemin, 'utf8')).replace('Bloc de démonstration', 'Bloc modifié'),
      )

      await expect(importerLesCatalogues(base, horlogeFausse(), fiches, contenu)).rejects.toThrow(
        /Fiche essai\/fiches\/D01\.html invalide[\s\S]*Incrémente la version/,
      )
    })
  })
})
