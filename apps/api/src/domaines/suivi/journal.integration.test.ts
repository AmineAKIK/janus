import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Manifeste, nouvelId, Reglages } from '@janus/contrats'
import type { Fait } from '@janus/contrats'
import { ajouterJours, exportTexte } from '@janus/moteur'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerFaux } from '../../adaptateurs/correcteur/faux.ts'
import { baseDepuisPool } from '../../base/base.ts'
import { lireFaits } from '../../base/faits.ts'
import * as t from '../../base/schema/index.ts'
import { creerBaseDeTest, URL_SERVEUR_TEST } from '../../base/testeurBase.ts'
import { configDeTest, ORIGINE_TEST, serveurDeTest } from '../../testeur.ts'
import { creerHacheur } from '../auth/composition.ts'
import { monterImportation } from '../catalogue/composition.ts'

const FICHE_DEMO = new URL('../../../../web/public/fiches/demo/fiche-demo.html', import.meta.url)
const MOT_DE_PASSE = 'un mot de passe solide'
const CATALOGUE = {
  formation: { code: 'DWWM', titre: 'Développeur web', description: 'Titre pro' },
  modules: [
    {
      code: 'M1',
      titre: 'Les bases',
      description: 'Pour commencer',
      ordre: 1,
      importe: true,
      parties: [{ code: 'P1', titre: 'Démarrer', blocs: ['D01'] }],
    },
  ],
}
const REPONSE_LONGUE =
  'Une fiche résume un seul bloc de cours avec ses exercices et son bilan, comme un petit guide.'

interface Page {
  modules: { id: string }[]
  entrees: {
    id: string
    date: string
    bloc: string
    type: string
    note: { id: string; texte: string; date: string } | null
  }[]
  suivant: string | null
  blocs: { bloc: string; statut: string }[]
  idees: { id: string; texte: string }[]
}

describe.skipIf(URL_SERVEUR_TEST === undefined)('journal contre PostgreSQL', () => {
  let bases: Awaited<ReturnType<typeof creerBaseDeTest>>
  let dossier = ''
  let s: Awaited<ReturnType<typeof serveurDeTest>>
  let cookie = ''
  let userId = ''
  let blocId = ''
  let ficheVersionId = ''
  let sequence = 0
  const identifiant = () => nouvelId(Date.parse('2026-10-03T10:00:00.000Z') + (sequence += 1))

  const lire = async (requete = '') => {
    const reponse = await s.app.inject({
      method: 'GET',
      url: `/api/journal${requete}`,
      headers: { cookie },
    })
    return { statusCode: reponse.statusCode, corps: reponse.json<Page>() }
  }
  const ouvrir = (date: string) =>
    bases.db.insert(t.evenements).values({
      id: identifiant(),
      userId,
      blocId,
      ficheVersionId,
      type: 'bloc_ouvert',
      donnees: { horsPrerequis: false },
      empreinte: 'e'.repeat(64),
      aide: null,
      dateServeur: date,
    })

  beforeAll(async () => {
    bases = await creerBaseDeTest(URL_SERVEUR_TEST ?? '')
    dossier = await mkdtemp(join(tmpdir(), 'janus-fiches-'))
    const base = baseDepuisPool(bases.db, bases.pool)
    const hacheur = creerHacheur(4)
    userId = nouvelId(Date.parse('2026-09-01T10:00:00.000Z'))
    await bases.db.insert(t.users).values({
      id: userId,
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
      correcteur: creerFaux(() => undefined),
    })
    const importation = monterImportation(base, s.horloge, dossier)
    await importation.importerCatalogue(CATALOGUE)
    await importation.importerFiche(await readFile(FICHE_DEMO, 'utf8'))
    const [bloc] = await bases.db.select({ id: t.blocs.id }).from(t.blocs)
    blocId = bloc?.id ?? ''
    const [version] = await bases.db.select({ id: t.fichesVersions.id }).from(t.fichesVersions)
    ficheVersionId = version?.id ?? ''
    const connexion = await s.app.inject({
      method: 'POST',
      url: '/api/session',
      headers: { origin: ORIGINE_TEST },
      payload: { nom_utilisateur: 'amine', mot_de_passe: MOT_DE_PASSE },
    })
    cookie = `janus_session=${connexion.cookies[0]?.value ?? ''}`
  })
  afterAll(async () => {
    await bases.supprimer()
    await rm(dossier, { recursive: true, force: true })
  })

  it('exige une connexion', async () => {
    expect((await s.app.inject({ method: 'GET', url: '/api/journal' })).statusCode).toBe(401)
    expect((await s.app.inject({ method: 'GET', url: '/api/journal/export.txt' })).statusCode).toBe(
      401,
    )
  })

  it('sans rien de fait : aucune ligne, l’état des blocs du premier module, aucune idée', async () => {
    const { statusCode, corps } = await lire()

    expect(statusCode).toBe(200)
    expect(corps).toMatchObject({
      modules: [{ id: 'M1' }],
      entrees: [],
      suivant: null,
      blocs: [{ bloc: 'D01', statut: 'non_commence' }],
      idees: [],
    })
  })

  describe('avec des faits, des notes et des idées', () => {
    beforeAll(async () => {
      await ouvrir('2026-10-03T08:00:00.000Z')
      const correction = await s.app.inject({
        method: 'POST',
        url: '/api/corrections',
        headers: { cookie, origin: ORIGINE_TEST },
        payload: {
          id: identifiant(),
          serie: 'restitution',
          tentative: 1,
          question: 'R1',
          reponse: REPONSE_LONGUE,
          confiance: 'sur',
          relance: '',
          support: { colle: false, retour_cours: false },
          bloc: 'D01',
          version: 1,
        },
      })
      expect(correction.statusCode).toBe(200)
    })

    it('rend les lignes du moteur, les plus récentes d’abord, et filtre par type et par bloc', async () => {
      const { corps } = await lire()

      expect(corps.entrees.length).toBeGreaterThanOrEqual(2)
      const dates = corps.entrees.map(({ date }) => date)
      expect(dates).toEqual([...dates].sort().reverse())
      const restitutions = (await lire('?type=restitution')).corps.entrees
      expect(restitutions.length).toBeGreaterThan(0)
      expect(restitutions.every(({ type }) => type === 'restitution')).toBe(true)
      expect((await lire('?bloc=D01')).corps.entrees).toHaveLength(corps.entrees.length)
      expect((await lire('?bloc=ZZ99')).corps.entrees).toEqual([])
      expect((await lire('?module=M1')).corps.entrees).toHaveLength(corps.entrees.length)
      expect((await lire('?type=inconnu')).statusCode).toBe(400)
    })

    it('rattache à la ligne sa note, dans sa dernière version et à la date de la première', async () => {
      const [ligne] = (await lire()).corps.entrees
      if (ligne === undefined) throw new Error('aucune ligne')
      const noteId = identifiant()
      await bases.db.insert(t.notesJournal).values([
        {
          id: identifiant(),
          noteId,
          userId,
          entree: ligne.id,
          texte: 'première version',
          dateServeur: '2026-10-03T09:10:00.000Z',
        },
        {
          id: identifiant(),
          noteId,
          userId,
          entree: ligne.id,
          texte: 'version corrigée',
          dateServeur: '2026-10-03T09:20:00.000Z',
        },
      ])

      const relue = (await lire()).corps.entrees.find(({ id }) => id === ligne.id)

      expect(relue?.note).toEqual({
        id: noteId,
        entree: ligne.id,
        date: '2026-10-03T09:10:00.000Z',
        texte: 'version corrigée',
      })
    })

    it('rend les idées, la plus récente d’abord', async () => {
      await bases.db.insert(t.idees).values([
        {
          id: identifiant(),
          userId,
          texte: 'première idée',
          dateServeur: '2026-10-03T09:30:00.000Z',
        },
        {
          id: identifiant(),
          userId,
          texte: 'seconde idée',
          dateServeur: '2026-10-03T09:40:00.000Z',
        },
      ])

      expect((await lire()).corps.idees.map(({ texte }) => texte)).toEqual([
        'seconde idée',
        'première idée',
      ])
    })

    it('pagine par curseur, sans perdre ni répéter de ligne', async () => {
      for (let jour = 0; jour < 60; jour += 1) {
        await ouvrir(`${ajouterJours('2026-01-01', jour)}T08:00:00.000Z`)
      }
      const toutes: string[] = []
      let avant: string | null = null
      let pages = 0
      do {
        const { corps }: { corps: Page } = await lire(avant === null ? '' : `?avant=${avant}`)
        toutes.push(...corps.entrees.map(({ id }) => id))
        avant = corps.suivant
        pages += 1
      } while (avant !== null && pages < 10)

      expect(pages).toBeGreaterThan(1)
      expect(new Set(toutes).size).toBe(toutes.length)
    })

    it('exporte le journal en texte brut, avec le générateur du moteur', async () => {
      await bases.db.insert(t.revuesMethode).values({
        id: identifiant(),
        userId,
        texte: 'Bilan de la revue',
        dateServeur: '2026-10-03T09:50:00.000Z',
      })

      const reponse = await s.app.inject({
        method: 'GET',
        url: '/api/journal/export.txt',
        headers: { cookie },
      })

      expect(reponse.statusCode).toBe(200)
      expect(reponse.headers['content-type']).toContain('text/plain')
      const lignes = await bases.db
        .select({ manifeste: t.fichesVersions.manifeste })
        .from(t.fichesVersions)
      const faits: Fait[] = await lireFaits(bases.db, userId, [{ id: blocId, code: 'D01' }])
      const [utilisateur] = await bases.db
        .select({ reglages: t.users.reglages })
        .from(t.users)
        .where(eq(t.users.id, userId))
      const attendu = exportTexte({
        manifestes: lignes.map(({ manifeste }) => Manifeste.parse(manifeste)),
        faits,
        reglages: Reglages.parse(utilisateur?.reglages),
        tachesReservees: [],
        idees: ['première idée', 'seconde idée'],
        derniereRevue: 'Bilan de la revue',
      })
      expect(reponse.body).toBe(attendu)
      expect(reponse.body).toContain('Bilan de la revue')
      expect(reponse.body).toContain('seconde idée')
    })
  })
})
