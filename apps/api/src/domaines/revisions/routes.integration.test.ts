import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nouvelId, Reglages } from '@janus/contrats'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerFaux } from '../../adaptateurs/correcteur/faux.ts'
import { baseDepuisPool } from '../../base/base.ts'
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

describe.skipIf(URL_SERVEUR_TEST === undefined)('GET /questions-debut contre PostgreSQL', () => {
  let bases: Awaited<ReturnType<typeof creerBaseDeTest>>
  let dossier = ''
  let s: Awaited<ReturnType<typeof serveurDeTest>>
  let cookie = ''
  let userId = ''
  let blocId = ''

  const lire = () =>
    s.app.inject({ method: 'GET', url: '/api/questions-debut', headers: { cookie } })

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
    const reponse = await s.app.inject({ method: 'GET', url: '/api/questions-debut' })
    expect(reponse.statusCode).toBe(401)
  })

  it('ne donne aucune carte tant qu’aucun bloc n’est vu', async () => {
    const reponse = await s.app.inject({
      method: 'GET',
      url: '/api/cartes/dues',
      headers: { cookie },
    })

    expect(reponse.json()).toEqual({ dues: [], nouvelles: [], prochaine: null })
  })

  it('ne tire rien tant qu’aucun bloc n’est vu', async () => {
    const reponse = await lire()

    expect(reponse.statusCode).toBe(200)
    expect(reponse.json()).toEqual({ questions: [] })
  })

  describe('avec un bloc vu', () => {
    beforeAll(async () => {
      await bases.db.insert(t.statutsForces).values({
        id: nouvelId(Date.parse('2026-09-02T10:00:00.000Z')),
        userId,
        blocId,
        dateServeur: s.horloge.maintenant(),
        action: 'forcer',
        statut: 'vu',
        raison: 'test',
      })
      // La série vide du premier test est gardée pour ce jour : on repart d'une journée neuve.
      await bases.db.delete(t.seriesQuestionsDebut).where(eq(t.seriesQuestionsDebut.userId, userId))
    })

    it('rend la même série à deux appels simultanés, sans dévoiler le bloc', async () => {
      const [a, b] = await Promise.all([lire(), lire()])

      expect(a.statusCode).toBe(200)
      expect(a.json()).toEqual(b.json())
      const { questions } = a.json<{ questions: Record<string, unknown>[] }>()
      expect(questions.length).toBeGreaterThan(0)
      for (const question of questions) {
        expect(question.deja).toBeNull()
        expect(JSON.stringify(question)).not.toContain('D01')
      }
      const { rows } = await bases.pool.query<{ n: string }>(
        'SELECT count(*) AS n FROM series_questions_debut WHERE user_id = $1',
        [userId],
      )
      expect(Number(rows[0]?.n)).toBe(1)
    })

    it('garde la série du jour d’un appel à l’autre', async () => {
      const premiere: unknown = (await lire()).json()
      const seconde: unknown = (await lire()).json()

      expect(seconde).toEqual(premiere)
    })

    it('corrige un rappel de la série sans bloc ni version, puis le rend en « deja »', async () => {
      const { questions } = (await lire()).json<{ questions: { id: string }[] }>()
      const premiere = questions[0]
      if (premiere === undefined) throw new Error('aucune question tirée')

      const correction = await s.app.inject({
        method: 'POST',
        url: '/api/corrections',
        headers: { cookie, origin: ORIGINE_TEST },
        payload: {
          id: nouvelId(Date.parse('2026-10-01T10:00:00.000Z')),
          serie: 'rappel',
          tentative: 1,
          question: premiere.id,
          reponse: REPONSE_LONGUE,
          confiance: 'hesitant',
          relance: '',
          support: { colle: false, retour_cours: false },
        },
      })
      expect(correction.statusCode).toBe(200)

      const relue = (await lire()).json<{
        questions: { id: string; deja: { bloc: string; confiance: string } | null }[]
      }>()
      const traitee = relue.questions.find(({ id }) => id === premiere.id)
      expect(traitee?.deja).toMatchObject({ bloc: 'D01', confiance: 'hesitant' })
    })

    describe('cartes', () => {
      type Carte = { id: string; bloc: string; nouvelle: boolean; apercu: Record<string, number> }
      type Dues = { dues: Carte[]; nouvelles: Carte[]; prochaine: string | null }
      const cartes = async () =>
        (
          await s.app.inject({ method: 'GET', url: '/api/cartes/dues', headers: { cookie } })
        ).json<Dues>()
      const noter = (id: string, corps: Record<string, unknown>) =>
        s.app.inject({
          method: 'POST',
          url: `/api/cartes/${encodeURIComponent(id)}/note`,
          headers: { cookie, origin: ORIGINE_TEST },
          payload: corps,
        })

      it('donne les nouvelles cartes du bloc vu, avec l’aperçu de chaque note', async () => {
        const { dues, nouvelles, prochaine } = await cartes()

        expect(dues).toEqual([])
        expect(prochaine).toBeNull()
        expect(nouvelles.length).toBeGreaterThan(0)
        for (const carte of nouvelles) {
          expect(carte).toMatchObject({ bloc: 'D01', nouvelle: true })
          expect(carte.id.startsWith('D01:')).toBe(true)
          expect(carte.apercu['a_revoir'] ?? 0).toBeLessThan(carte.apercu['facile'] ?? 0)
        }
      })

      it('note une carte : FSRS programme la suite et la nouvelle carte sort de la liste', async () => {
        const avant = await cartes()
        const carte = avant.nouvelles[0]
        if (carte === undefined) throw new Error('aucune carte')
        const corps = { id: nouvelId(Date.parse('2026-10-02T10:00:00.000Z')), note: 'bien' }

        const reponse = await noter(carte.id, corps)

        expect(reponse.statusCode).toBe(200)
        const { echeance } = reponse.json<{ echeance: string }>()
        expect(echeance > s.horloge.maintenant()).toBe(true)
        const apres = await cartes()
        expect(apres.nouvelles.map(({ id }) => id)).not.toContain(carte.id)
        expect(apres.nouvelles).toHaveLength(avant.nouvelles.length - 1)
        expect(apres.dues.map(({ id }) => id)).not.toContain(carte.id)
        expect(apres.prochaine).toBe(echeance)
      })

      it('rejouer la même note ne change rien', async () => {
        const carte = (await cartes()).nouvelles[0]
        if (carte === undefined) throw new Error('aucune carte')
        const corps = { id: nouvelId(Date.parse('2026-10-02T10:00:01.000Z')), note: 'facile' }

        const premiere = await noter(carte.id, corps)
        const seconde = await noter(carte.id, corps)

        expect(seconde.json()).toEqual(premiere.json())
        const { rows } = await bases.pool.query<{ n: string }>(
          'SELECT count(*) AS n FROM revues_fsrs WHERE user_id = $1',
          [userId],
        )
        expect(Number(rows[0]?.n ?? 0)).toBe(2)
      })

      it('refuse une carte inconnue (404) et une note invalide (400)', async () => {
        const id = nouvelId(Date.parse('2026-10-02T10:00:02.000Z'))
        expect((await noter('D01:NOPE', { id, note: 'bien' })).statusCode).toBe(404)
        expect((await noter('sans-separateur', { id, note: 'bien' })).statusCode).toBe(404)
        expect((await noter('D01:CA1', { id, note: 'nulle' })).statusCode).toBe(400)
      })
    })

    it('refuse un rappel dont la question n’est pas dans la série du jour', async () => {
      const reponse = await s.app.inject({
        method: 'POST',
        url: '/api/corrections',
        headers: { cookie, origin: ORIGINE_TEST },
        payload: {
          id: nouvelId(Date.parse('2026-10-01T10:00:01.000Z')),
          serie: 'rappel',
          tentative: 1,
          question: 'INCONNUE',
          reponse: REPONSE_LONGUE,
          confiance: 'sur',
          relance: '',
          support: { colle: false, retour_cours: false },
        },
      })
      expect(reponse.statusCode).toBe(404)
    })
  })
})
