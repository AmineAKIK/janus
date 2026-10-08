import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { baseDepuisPool } from '../../base/base.ts'
import * as t from '../../base/schema/index.ts'
import { creerBaseDeTest, URL_SERVEUR_TEST } from '../../base/testeurBase.ts'
import { horlogeFausse } from '../../testeur.ts'
import { SEUIL_MEDIAS_OCTETS } from './adaptateur.ts'
import { ErreurImport, monterImportation } from './composition.ts'

const Manifeste = z.record(z.string(), z.unknown())
const Cartes = z.array(z.strictObject({ id: z.string(), recto: z.string(), verso: z.string() }))

const FICHE_DEMO = new URL('../../../../web/public/fiches/demo/fiche-demo.html', import.meta.url)

const CATALOGUE = {
  formation: { code: 'DWWM', titre: 'Développeur web et web mobile', description: 'Titre pro' },
  modules: [
    {
      code: 'M1',
      titre: 'Les bases',
      description: 'Pour commencer',
      ordre: 1,
      importe: true,
      parties: [{ code: 'P1', titre: 'Démarrer', blocs: ['D01', 'D02'] }],
    },
    { code: 'M2', titre: 'Plus tard', description: '', ordre: 2, importe: false },
  ],
}

describe.skipIf(URL_SERVEUR_TEST === undefined)('import du catalogue et des fiches', () => {
  let bases: Awaited<ReturnType<typeof creerBaseDeTest>>
  let dossier = ''
  let service: ReturnType<typeof monterImportation>
  let demo = ''
  const horloge = horlogeFausse()

  beforeAll(async () => {
    bases = await creerBaseDeTest(URL_SERVEUR_TEST ?? '')
    dossier = await mkdtemp(join(tmpdir(), 'janus-fiches-'))
    service = monterImportation(baseDepuisPool(bases.db, bases.pool), horloge, dossier)
    demo = await readFile(FICHE_DEMO, 'utf8')
  })
  afterAll(async () => {
    await bases.supprimer()
    await rm(dossier, { recursive: true, force: true })
  })

  /** Remplace le manifeste de la fiche de démo par une version modifiée. */
  function avecManifeste(modifier: (manifeste: Record<string, unknown>) => void, html = demo) {
    return html.replace(
      /(<script id="manifeste" type="application\/json">)([\s\S]*?)(<\/script>)/,
      (_tout, debut: string, json: string, fin: string) => {
        const manifeste = Manifeste.parse(JSON.parse(json))
        modifier(manifeste)
        return `${debut}${JSON.stringify(manifeste)}${fin}`
      },
    )
  }

  const compter = async (
    table: 'formations' | 'modules' | 'parties' | 'blocs' | 'cartes' | 'fiches_versions',
  ) => {
    const { rows } = await bases.pool.query<{ n: string }>(`SELECT count(*) AS n FROM ${table}`)
    return Number(rows[0]?.n)
  }

  async function echec(promesse: Promise<unknown>): Promise<readonly string[]> {
    const erreur: unknown = await promesse.then(
      () => null,
      (e: unknown) => e,
    )
    if (!(erreur instanceof ErreurImport)) throw new Error('Un refus d’import était attendu.')
    return erreur.problemes
  }

  describe('le catalogue', () => {
    it('crée la formation, les modules, les parties et les blocs', async () => {
      const compte = await service.importerCatalogue(CATALOGUE)

      expect(compte).toEqual({ formations: 1, modules: 2, parties: 1, blocs: 2 })
      const modules = await bases.db.select().from(t.modules).orderBy(t.modules.ordre)
      expect(modules.map(({ code, importe }) => [code, importe])).toEqual([
        ['M1', true],
        ['M2', false],
      ])
      const blocs = await bases.db.select().from(t.blocs).orderBy(t.blocs.ordre)
      expect(blocs.map(({ code, ordre }) => [code, ordre])).toEqual([
        ['D01', 1],
        ['D02', 2],
      ])
    })

    it('ne crée rien de plus quand on le relance, et met à jour les titres', async () => {
      const avant = [
        await compter('formations'),
        await compter('modules'),
        await compter('parties'),
        await compter('blocs'),
      ]

      const compte = await service.importerCatalogue({
        ...CATALOGUE,
        formation: { ...CATALOGUE.formation, titre: 'Nouveau titre' },
      })

      expect(compte).toEqual({ formations: 0, modules: 0, parties: 0, blocs: 0 })
      expect([
        await compter('formations'),
        await compter('modules'),
        await compter('parties'),
        await compter('blocs'),
      ]).toEqual(avant)
      const [formation] = await bases.db.select().from(t.formations)
      expect(formation?.titre).toBe('Nouveau titre')
    })

    it('refuse un catalogue invalide avec tous ses problèmes', async () => {
      const problemes = await echec(
        service.importerCatalogue({
          formation: { code: '', titre: 'x' },
          modules: [{ code: 'M' }],
        }),
      )

      expect(problemes.length).toBeGreaterThan(2)
      expect(await compter('formations')).toBe(1)
    })
  })

  describe('une fiche', () => {
    it('importe la fiche de démo : version, fichier sous son empreinte, cartes', async () => {
      const resultat = await service.importerFiche(demo)

      expect(resultat).toMatchObject({ bloc: 'D01', version: 1, dejaImportee: false, sons: 0 })
      expect(resultat.cartes.total).toBeGreaterThan(0)
      expect(resultat.cartes.ajoutees).toBe(resultat.cartes.total)
      expect(await compter('cartes')).toBe(resultat.cartes.total)
      const [version] = await bases.db.select().from(t.fichesVersions)
      expect(version?.empreinte).toBe(resultat.empreinte)
      expect(version?.chemin).toBe(`D01/${resultat.empreinte}.html`)
      expect(await readFile(join(dossier, 'D01', `${resultat.empreinte}.html`), 'utf8')).toBe(demo)
      const [bloc] = await bases.db.select().from(t.blocs).where(eq(t.blocs.code, 'D01'))
      expect(bloc?.titre).not.toBe('D01')
    })

    it('ne change rien quand on importe deux fois la même fiche', async () => {
      const versions = await compter('fiches_versions')
      const cartes = await compter('cartes')

      const resultat = await service.importerFiche(demo)

      expect(resultat.dejaImportee).toBe(true)
      expect(await compter('fiches_versions')).toBe(versions)
      expect(await compter('cartes')).toBe(cartes)
    })

    it('refuse une fiche modifiée sous la même version', async () => {
      const modifiee = avecManifeste((manifeste) => {
        manifeste['objectif'] = 'Un autre objectif'
      })

      const problemes = await echec(service.importerFiche(modifiee))

      expect(problemes.join(' ')).toMatch(
        /version 1 de D01 est déjà importée avec un autre contenu/,
      )
      expect(await compter('fiches_versions')).toBe(1)
    })

    it('importe une nouvelle version, ajoute les cartes nouvelles et marque les retirées inactives', async () => {
      const avant = await bases.db.select().from(t.cartes).where(eq(t.cartes.active, true))
      const retiree = avant[0]?.carteId
      const nouvelle = avecManifeste((manifeste) => {
        manifeste['version'] = 2
        const cartes = Cartes.parse(manifeste['cartes'])
        manifeste['cartes'] = [
          ...cartes.filter((carte) => carte.id !== retiree),
          { id: 'carte-neuve', recto: 'Recto neuf', verso: 'Verso neuf' },
        ]
      })

      const resultat = await service.importerFiche(nouvelle)

      expect(resultat).toMatchObject({ version: 2, dejaImportee: false })
      expect(resultat.cartes).toMatchObject({ ajoutees: 1, retirees: 1 })
      const toutes = await bases.db.select().from(t.cartes)
      expect(toutes).toHaveLength(avant.length + 1)
      expect(toutes.find(({ carteId }) => carteId === retiree)?.active).toBe(false)
      expect(toutes.find(({ carteId }) => carteId === 'carte-neuve')?.active).toBe(true)
      expect(await compter('fiches_versions')).toBe(2)
    })

    it('refuse un manifeste invalide avec tous ses problèmes', async () => {
      const invalide = avecManifeste((manifeste) => {
        manifeste['titre'] = ''
        manifeste['version'] = 0
        manifeste['pont'] = 'x'
      })

      const problemes = await echec(service.importerFiche(invalide))

      expect(problemes.length).toBeGreaterThanOrEqual(3)
    })

    it('refuse une page sans manifeste ou avec un JSON illisible', async () => {
      expect((await echec(service.importerFiche('<html></html>')))[0]).toMatch(/Aucun manifeste/)
      const casse = demo.replace(/(<script id="manifeste" type="application\/json">)/, '$1{')
      expect((await echec(service.importerFiche(casse)))[0]).toMatch(/pas du JSON valide/)
    })

    it('refuse un bloc qui n’est pas au catalogue', async () => {
      const inconnue = avecManifeste((manifeste) => {
        manifeste['bloc'] = 'Z99'
      })

      const problemes = await echec(service.importerFiche(inconnue))

      expect(problemes[0]).toMatch(/Z99 n’existe pas dans le catalogue/)
    })

    it('extrait les sons au-delà de 2 Mo et écrit la fiche réécrite sous son empreinte', async () => {
      await bases.db.insert(t.blocs).values({
        id: '0198f3a0-0000-7000-8000-000000000001',
        moduleId: (await bases.db.select().from(t.modules))[0]?.id ?? '',
        code: 'D03',
        titre: 'D03',
        ordre: 3,
      })
      const lourde = avecManifeste((manifeste) => {
        manifeste['bloc'] = 'D03'
      }).replace(
        '</body>',
        `<audio src="data:audio/mpeg;base64,${'QUJD'.repeat(SEUIL_MEDIAS_OCTETS / 4 + 10)}"></audio></body>`,
      )

      const resultat = await service.importerFiche(lourde)

      expect(resultat.sons).toBe(1)
      const fichiers = await readdir(join(dossier, 'D03'))
      expect(fichiers).toHaveLength(2)
      const html = await readFile(join(dossier, 'D03', `${resultat.empreinte}.html`), 'utf8')
      const son = fichiers.find((nom) => nom.endsWith('.mp3')) ?? ''
      expect(html).toContain(`<audio src="${son}"></audio>`)
      expect(html).not.toContain('data:audio')
      expect(resultat.octets).toBeLessThan(lourde.length)
      expect((await service.importerFiche(lourde)).dejaImportee).toBe(true)
    })
  })
})
