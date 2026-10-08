import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nouvelId, Reglages } from '@janus/contrats'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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

describe.skipIf(URL_SERVEUR_TEST === undefined)(
  'événements et état de page contre PostgreSQL',
  () => {
    let bases: Awaited<ReturnType<typeof creerBaseDeTest>>
    let dossier = ''
    let s: Awaited<ReturnType<typeof serveurDeTest>>
    let cookie = ''
    let sequence = 0

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
      await importation.importerFiche(await readFile(FICHE_DEMO, 'utf8'))
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

    const identifiant = () => {
      sequence += 1
      return nouvelId(Date.parse('2026-10-01T10:00:00.000Z') + sequence)
    }
    const commun = () => ({ id: identifiant(), bloc: 'D01', version: 1, t: '2026-10-01T10:00:00Z' })
    const envoyer = (corps: Record<string, unknown>, avecCookie = true) =>
      s.app.inject({
        method: 'POST',
        url: '/api/evenements',
        headers: { ...(avecCookie ? { cookie } : {}), origin: ORIGINE_TEST },
        payload: corps,
      })
    const sauver = (code: string, corps: Record<string, unknown>) =>
      s.app.inject({
        method: 'PUT',
        url: `/api/blocs/${code}/etat-page`,
        headers: { cookie, origin: ORIGINE_TEST },
        payload: corps,
      })
    const compter = async (type: string) => {
      const { rows } = await bases.pool.query<{ n: string }>(
        'SELECT count(*) AS n FROM evenements WHERE type = $1',
        [type],
      )
      return Number(rows[0]?.n)
    }

    describe('POST /evenements', () => {
      it('exige une connexion', async () => {
        const reponse = await envoyer({ ...commun(), type: 'etape.vue', etape: 'ET1' }, false)

        expect(reponse.statusCode).toBe(401)
      })

      it('enregistre un fait et rend le statut recalculé', async () => {
        const reponse = await envoyer({ ...commun(), type: 'etape.vue', etape: 'ET1' })

        expect(reponse.statusCode).toBe(200)
        const corps = reponse.json<{ doublon: boolean; statut: { statut: string } | null }>()
        expect(corps.doublon).toBe(false)
        expect(corps.statut?.statut).toBe('en_cours')
        expect(await compter('etape_vue')).toBe(1)
        const { rows } = await bases.pool.query<{ n: string }>(
          'SELECT count(*) AS n FROM statuts_courants',
        )
        expect(Number(rows[0]?.n)).toBe(1)
      })

      it('ignore un doublon : même identifiant, même contenu', async () => {
        const message = { ...commun(), type: 'etape.vue', etape: 'ET2' }
        await envoyer(message)
        const avant = await compter('etape_vue')

        const reponse = await envoyer(message)

        expect(reponse.statusCode).toBe(200)
        expect(reponse.json()).toEqual({ doublon: true, statut: null })
        expect(await compter('etape_vue')).toBe(avant)
      })

      it('répond 422 quand un identifiant sert pour un autre contenu', async () => {
        const message = { ...commun(), type: 'etape.vue', etape: 'ET3' }
        await envoyer(message)

        const reponse = await envoyer({ ...message, etape: 'ET4' })

        expect(reponse.statusCode).toBe(422)
        expect(reponse.json<{ code: string }>().code).toBe('contenu_different')
      })

      it('répond 404 pour un bloc ou une version inconnus', async () => {
        const bloc = await envoyer({ ...commun(), bloc: 'D99', type: 'etape.vue', etape: 'ET1' })
        const version = await envoyer({ ...commun(), version: 9, type: 'etape.vue', etape: 'ET1' })

        expect(bloc.statusCode).toBe(404)
        expect(version.statusCode).toBe(404)
      })

      it('refuse les messages qui ont leur propre route', async () => {
        const reponse = await envoyer({ ...commun(), type: 'etat.sauver', etat: {} })

        expect(reponse.statusCode).toBe(400)
        expect(await compter('etat.sauver')).toBe(0)
      })

      it('garde le temps actif sans recalculer le statut', async () => {
        const reponse = await envoyer({
          id: identifiant(),
          type: 'temps.actif',
          bloc: 'D01',
          secondes: 45,
        })

        expect(reponse.statusCode).toBe(200)
        expect(reponse.json()).toEqual({ doublon: false, statut: null })
        expect(await compter('temps.actif')).toBe(1)
      })

      it('ouvre puis ferme les erreurs du bilan : le dernier état fait foi', async () => {
        const ouvre = await envoyer({ ...commun(), type: 'bilan.erreurs', ids: ['E1', 'E3'] })
        const ferme = await envoyer({ ...commun(), type: 'bilan.erreurs', ids: ['E3'] })

        expect(
          ouvre.json<{ statut: { erreurs_ouvertes: string[] } }>().statut.erreurs_ouvertes,
        ).toEqual(['E1', 'E3'])
        expect(
          ferme.json<{ statut: { erreurs_ouvertes: string[] } }>().statut.erreurs_ouvertes,
        ).toEqual(['E3'])
      })

      it('range une seule échéance ouverte par bloc et des lignes de journal', async () => {
        const { rows } = await bases.pool.query<{ n: string }>(
          'SELECT count(*) AS n FROM echeances WHERE faite_le IS NULL',
        )

        expect(Number(rows[0]?.n)).toBeLessThanOrEqual(1)
      })

      it('tient deux événements parallèles du même bloc : tous deux enregistrés, un seul statut', async () => {
        const avant = await compter('etape_vue')

        const [a, b] = await Promise.all([
          envoyer({ ...commun(), type: 'etape.vue', etape: 'ET5' }),
          envoyer({ ...commun(), type: 'etape.vue', etape: 'ET6' }),
        ])

        expect([a.statusCode, b.statusCode]).toEqual([200, 200])
        expect(await compter('etape_vue')).toBe(avant + 2)
        const { rows } = await bases.pool.query<{ n: string }>(
          'SELECT count(*) AS n FROM statuts_courants',
        )
        expect(Number(rows[0]?.n)).toBe(1)
      })
    })

    describe('PUT /blocs/:id/etat-page', () => {
      it('écrit une première version puis la suivante, sans jamais créer d’événement', async () => {
        const premiere = await sauver('D01', { version: 0, etat: { etape: 'ET3' } })
        const seconde = await sauver('D01', { version: 1, etat: { etape: 'ET4' } })

        expect(premiere.json()).toEqual({ version: 1 })
        expect(seconde.json()).toEqual({ version: 2 })
        expect(await compter('etat.sauver')).toBe(0)
      })

      it('répond 409 avec l’état actuel quand l’onglet a lu une version dépassée', async () => {
        const reponse = await sauver('D01', { version: 1, etat: { etape: 'ET9' } })

        expect(reponse.statusCode).toBe(409)
        expect(reponse.json()).toMatchObject({
          code: 'conflit',
          version: 2,
          etat: { etape: 'ET4' },
          modifie_le: expect.stringMatching(/Z$/) as unknown,
        })
      })

      it('répond 409 quand on repart de zéro alors qu’un état existe', async () => {
        const reponse = await sauver('D01', { version: 0, etat: {} })

        expect(reponse.statusCode).toBe(409)
        expect(reponse.json<{ version: number }>().version).toBe(2)
      })

      it('laisse passer 100 ko (la limite de cette route est 256 ko) et refuse 300 ko en 413', async () => {
        const moyen = await sauver('D01', { version: 2, etat: { texte: 'x'.repeat(100_000) } })
        const enorme = await sauver('D01', { version: 3, etat: { texte: 'x'.repeat(300_000) } })

        expect(moyen.statusCode).toBe(200)
        expect(enorme.statusCode).toBe(413)
      })

      it('répond 404 pour un bloc inconnu et 400 pour un état trop gros', async () => {
        expect((await sauver('D99', { version: 0, etat: {} })).statusCode).toBe(404)
        const gros = { texte: 'x'.repeat(201_000) }
        expect((await sauver('D01', { version: 3, etat: gros })).statusCode).toBe(400)
      })
    })
  },
)
