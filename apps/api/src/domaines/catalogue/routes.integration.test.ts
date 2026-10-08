import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nouvelId, Reglages } from '@janus/contrats'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { baseDepuisPool } from '../../base/base.ts'
import * as t from '../../base/schema/index.ts'
import { creerBaseDeTest, URL_SERVEUR_TEST } from '../../base/testeurBase.ts'
import { configDeTest, ORIGINE_TEST, serveurDeTest } from '../../testeur.ts'
import { creerHacheur } from '../auth/composition.ts'
import { monterImportation } from './composition.ts'

const FICHE_DEMO = new URL('../../../../web/public/fiches/demo/fiche-demo.html', import.meta.url)
const MOT_DE_PASSE = 'un mot de passe solide'
const Objet = z.record(z.string(), z.unknown())

const CATALOGUE = {
  formation: { code: 'DWWM', titre: 'Développeur web', description: 'Titre pro' },
  modules: [
    {
      code: 'M1',
      titre: 'Les bases',
      description: 'Pour commencer',
      ordre: 1,
      importe: true,
      parties: [{ code: 'P1', titre: 'Démarrer', blocs: ['D01', 'D02', 'D03'] }],
    },
    { code: 'M2', titre: 'Plus tard', description: '', ordre: 2, importe: false },
  ],
}

describe.skipIf(URL_SERVEUR_TEST === undefined)('routes du catalogue contre PostgreSQL', () => {
  let bases: Awaited<ReturnType<typeof creerBaseDeTest>>
  let dossier = ''
  let s: Awaited<ReturnType<typeof serveurDeTest>>
  let cookie = ''
  let empreinteD01 = ''
  let moduleId = ''
  let formationId = ''

  function ficheAvec(modifier: (manifeste: Record<string, unknown>) => void, html: string) {
    return html.replace(
      /(<script id="manifeste" type="application\/json">)([\s\S]*?)(<\/script>)/,
      (_tout, debut: string, json: string, fin: string) => {
        const manifeste = Objet.parse(JSON.parse(json))
        modifier(manifeste)
        return `${debut}${JSON.stringify(manifeste)}${fin}`
      },
    )
  }

  beforeAll(async () => {
    bases = await creerBaseDeTest(URL_SERVEUR_TEST ?? '')
    dossier = await mkdtemp(join(tmpdir(), 'janus-fiches-'))
    const base = baseDepuisPool(bases.db, bases.pool)
    const hacheur = creerHacheur(4)
    await bases.db.insert(t.users).values({
      id: nouvelId(Date.parse('2026-09-01T10:00:00.000Z')),
      nomUtilisateur: 'amine',
      motDePasseHash: await hacheur.hacher(MOT_DE_PASSE),
      reglages: Reglages.parse({}),
      creeLe: '2026-09-01T10:00:00.000Z',
    })
    s = await serveurDeTest({
      base,
      proprietaire: base,
      hacheur,
      config: configDeTest({ NIVEAU_JOURNAL: 'silent' }),
    })
    const importation = monterImportation(base, s.horloge, dossier)
    await importation.importerCatalogue(CATALOGUE)
    const demo = await readFile(FICHE_DEMO, 'utf8')
    empreinteD01 = (await importation.importerFiche(demo)).empreinte
    await importation.importerFiche(
      ficheAvec((m) => {
        m['bloc'] = 'D02'
        m['prerequis'] = ['D01']
      }, demo),
    )
    const connexion = await s.app.inject({
      method: 'POST',
      url: '/api/session',
      headers: { origin: ORIGINE_TEST },
      payload: { nom_utilisateur: 'amine', mot_de_passe: MOT_DE_PASSE },
    })
    cookie = `janus_session=${connexion.cookies[0]?.value ?? ''}`
    const [m1] = await bases.db
      .select({ id: t.modules.id })
      .from(t.modules)
      .where(eq(t.modules.code, 'M1'))
    moduleId = m1?.id ?? ''
    formationId = (await bases.db.select({ id: t.formations.id }).from(t.formations))[0]?.id ?? ''
  })
  afterAll(async () => {
    await bases.supprimer()
    await rm(dossier, { recursive: true, force: true })
  })

  const lire = (url: string) =>
    s.app.inject({ method: 'GET', url: `/api${url}`, headers: { cookie } })
  const ouvrir = (code: string, corps: Record<string, unknown>) =>
    s.app.inject({
      method: 'POST',
      url: `/api/blocs/${code}/ouvrir`,
      headers: { cookie, origin: ORIGINE_TEST },
      payload: corps,
    })
  const identifiant = () =>
    nouvelId(Date.parse('2026-10-01T10:00:00.000Z') + Math.floor(Math.random() * 1e9))
  const nombreDOuvertures = async (code: string) => {
    const { rows } = await bases.pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM evenements e JOIN blocs b ON b.id = e.bloc_id WHERE b.code = '${code}'`,
    )
    return Number(rows[0]?.n)
  }

  describe('la lecture', () => {
    it('exige une connexion', async () => {
      const reponse = await s.app.inject({ method: 'GET', url: '/api/formations' })

      expect(reponse.statusCode).toBe(401)
    })

    it('liste les formations avec leur description', async () => {
      const reponse = await lire('/formations')

      expect(reponse.statusCode).toBe(200)
      expect(reponse.json()).toEqual({
        formations: [{ id: formationId, titre: 'Développeur web', description: 'Titre pro' }],
      })
    })

    it('liste les modules d’une formation, dans l’ordre, avec leur état d’import', async () => {
      const reponse = await lire(`/formations/${formationId}/modules`)

      expect(reponse.statusCode).toBe(200)
      expect(
        reponse
          .json<{ modules: { code: string; importe: boolean; ordre: number }[] }>()
          .modules.map(({ code, importe, ordre }) => [code, importe, ordre]),
      ).toEqual([
        ['M1', true, 1],
        ['M2', false, 2],
      ])
    })

    it('répond 404 pour une formation ou un module inconnus, ou qui n’est pas un identifiant', async () => {
      const inconnu = '0198f3a0-0000-7000-8000-0000000000aa'

      expect((await lire(`/formations/${inconnu}/modules`)).statusCode).toBe(404)
      expect((await lire('/formations/abc/modules')).statusCode).toBe(404)
      expect((await lire(`/modules/${inconnu}/blocs`)).statusCode).toBe(404)
      expect((await lire('/modules/abc/blocs')).statusCode).toBe(404)
    })

    it('liste les blocs importés d’un module sans jamais leur manifeste', async () => {
      const reponse = await lire(`/modules/${moduleId}/blocs`)

      expect(reponse.statusCode).toBe(200)
      const { blocs } = reponse.json<{ blocs: Record<string, unknown>[] }>()
      expect(blocs.map(({ bloc }) => bloc)).toEqual(['D01', 'D02'])
      expect(blocs[0]).toEqual({
        bloc: 'D01',
        titre: 'Bloc de démonstration',
        titre_court: 'Démo',
        partie: 'P1 Démarrer',
        prerequis: [],
        statut: 'non_commence',
      })
      expect(blocs[1]).toMatchObject({ prerequis: ['D01'] })
      expect(reponse.body).not.toContain('"etapes"')
    })

    it('ne liste rien pour un module pas encore importé', async () => {
      const [m2] = await bases.db
        .select({ id: t.modules.id })
        .from(t.modules)
        .where(eq(t.modules.code, 'M2'))

      const reponse = await lire(`/modules/${m2?.id ?? ''}/blocs`)

      expect(reponse.json()).toEqual({ blocs: [] })
    })

    it('rend un bloc avec son manifeste, sa version, l’adresse de sa fiche et un accès libre', async () => {
      const reponse = await lire('/blocs/D01')

      expect(reponse.statusCode).toBe(200)
      expect(reponse.json()).toMatchObject({
        bloc: 'D01',
        module: moduleId,
        version: 1,
        statut: 'non_commence',
        problemes: [],
        acces: 'libre',
        force: null,
        etat_page: null,
        fiche_url: `https://fiches.test/D01/${empreinteD01}.html`,
        serie_ouverte: { restitution: true, consolidation: false },
        manifeste: { bloc: 'D01', version: 1 },
      })
    })

    it('répond 404 pour un bloc inconnu ou sans fiche importée', async () => {
      expect((await lire('/blocs/Z99')).statusCode).toBe(404)
      expect((await lire('/blocs/D03')).statusCode).toBe(404)
    })

    it('rend l’état de page sauvé, avec sa version', async () => {
      const [bloc] = await bases.db
        .select({ id: t.blocs.id })
        .from(t.blocs)
        .where(eq(t.blocs.code, 'D01'))
      const [utilisateur] = await bases.db.select({ id: t.users.id }).from(t.users)
      await bases.db.insert(t.etatsPage).values({
        userId: utilisateur?.id ?? '',
        blocId: bloc?.id ?? '',
        etat: { etapeCourante: 'E1' },
        version: 3,
        misAJourLe: '2026-10-01T10:00:00.000Z',
      })

      const reponse = await lire('/blocs/D01')

      expect(reponse.statusCode).toBe(200)
      expect(reponse.json<{ etat_page: { version: number } }>().etat_page.version).toBe(3)
      await bases.db.delete(t.etatsPage)
    })

    it('rejoue le validateur : une fiche que le validateur refuse porte ses problèmes', async () => {
      const [d03] = await bases.db
        .select({ id: t.blocs.id })
        .from(t.blocs)
        .where(eq(t.blocs.code, 'D03'))
      const demo = await readFile(FICHE_DEMO, 'utf8')
      const brut =
        /<script id="manifeste" type="application\/json">([\s\S]*?)<\/script>/.exec(demo)?.[1] ??
        '{}'
      const manifeste = Objet.parse(JSON.parse(brut))
      manifeste['bloc'] = 'D03'
      const erreurs = z
        .array(
          z.strictObject({ id: z.string(), libelle: z.string(), etape: z.string().optional() }),
        )
        .parse(manifeste['erreurs_critiques'])
      manifeste['erreurs_critiques'] = [...erreurs, ...erreurs.slice(0, 1)]
      await bases.db.insert(t.fichesVersions).values({
        id: identifiant(),
        blocId: d03?.id ?? '',
        version: 1,
        empreinte: 'e'.repeat(64),
        chemin: 'D03/e.html',
        manifeste,
        creeLe: '2026-10-01T10:00:00.000Z',
      })

      const reponse = await lire('/blocs/D03')

      expect(reponse.statusCode).toBe(200)
      expect(reponse.json<{ problemes: string[] }>().problemes.length).toBeGreaterThan(0)
    })
  })

  describe('POST /blocs/:id/ouvrir', () => {
    it('ouvre un bloc libre, écrit le fait et recalcule le statut', async () => {
      const id = identifiant()

      const reponse = await ouvrir('D01', { id, hors_prerequis: false })

      expect(reponse.statusCode).toBe(200)
      expect(reponse.json()).toMatchObject({ acces: 'libre', statut: 'en_cours' })
      expect(await nombreDOuvertures('D01')).toBe(1)
      expect((await lire('/blocs/D01')).json()).toMatchObject({ statut: 'en_cours' })
      expect(
        (await lire(`/modules/${moduleId}/blocs`)).json<{
          blocs: { bloc: string; statut: string }[]
        }>().blocs[0],
      ).toMatchObject({ statut: 'en_cours' })
    })

    it('rend le résultat d’origine pour le même identifiant et le même contenu, sans rien écrire de plus', async () => {
      const id = identifiant()
      const premiere = await ouvrir('D01', { id, hors_prerequis: false })
      const avant = await nombreDOuvertures('D01')

      const seconde = await ouvrir('D01', { id, hors_prerequis: false })

      expect(seconde.statusCode).toBe(200)
      expect(seconde.json()).toEqual(premiere.json())
      expect(await nombreDOuvertures('D01')).toBe(avant)
    })

    it('refuse 422 le même identifiant avec un autre contenu', async () => {
      const id = identifiant()
      await ouvrir('D01', { id, hors_prerequis: false })

      const reponse = await ouvrir('D01', { id, hors_prerequis: true, raison: 'autre chose' })

      expect(reponse.statusCode).toBe(422)
      expect(reponse.json()).toMatchObject({ code: 'contenu_different' })
    })

    it('exige une raison quand les prérequis ne sont pas acquis, et l’accepte avec elle', async () => {
      const sans = await ouvrir('D02', { id: identifiant(), hors_prerequis: false })
      const ouvertSansRaison = await ouvrir('D02', { id: identifiant(), hors_prerequis: true })
      const avec = await ouvrir('D02', {
        id: identifiant(),
        hors_prerequis: true,
        raison: 'Je connais déjà ce sujet',
      })

      expect(sans.statusCode).toBe(400)
      expect(sans.json()).toMatchObject({ code: 'donnees_invalides', title: 'Raison exigée' })
      expect(ouvertSansRaison.statusCode).toBe(400)
      expect(avec.statusCode).toBe(200)
      expect(avec.json()).toMatchObject({ acces: 'raison_requise', statut: 'en_cours' })
    })

    it('répond 404 pour un bloc sans fiche, 400 sans identifiant, 403 sans l’Origin de l’appli', async () => {
      expect((await ouvrir('Z99', { id: identifiant(), hors_prerequis: false })).statusCode).toBe(
        404,
      )
      expect((await ouvrir('D01', { hors_prerequis: false })).statusCode).toBe(400)
      const sansOrigine = await s.app.inject({
        method: 'POST',
        url: '/api/blocs/D01/ouvrir',
        headers: { cookie },
        payload: { id: identifiant(), hors_prerequis: false },
      })
      expect(sansOrigine.statusCode).toBe(403)
    })

    it('garde un statut cohérent quand deux ouvertures arrivent en même temps', async () => {
      const avant = await nombreDOuvertures('D01')

      const reponses = await Promise.all([
        ouvrir('D01', { id: identifiant(), hors_prerequis: false }),
        ouvrir('D01', { id: identifiant(), hors_prerequis: false }),
      ])

      expect(reponses.map(({ statusCode }) => statusCode)).toEqual([200, 200])
      expect(reponses.map((reponse) => reponse.json<{ statut: string }>().statut)).toEqual([
        'en_cours',
        'en_cours',
      ])
      expect(await nombreDOuvertures('D01')).toBe(avant + 2)
    })
  })
})
