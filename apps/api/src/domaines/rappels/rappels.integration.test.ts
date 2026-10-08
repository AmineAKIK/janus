import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nouvelId, Reglages } from '@janus/contrats'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerFaux } from '../../adaptateurs/correcteur/faux.ts'
import { creerEnvoyeurFaux } from '../../adaptateurs/push/faux.ts'
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
const ABONNEMENT = {
  endpoint: 'https://push.example.test/abonnement-1',
  cles: { p256dh: 'cle-p256dh', auth: 'cle-auth' },
}

describe.skipIf(URL_SERVEUR_TEST === undefined)('rappels contre PostgreSQL', () => {
  let bases: Awaited<ReturnType<typeof creerBaseDeTest>>
  let dossier = ''
  let s: Awaited<ReturnType<typeof serveurDeTest>>
  let cookie = ''
  let userId = ''
  let autreId = ''
  let blocId = ''
  let sequence = 0
  const identifiant = () => nouvelId(Date.parse('2026-10-01T10:00:00.000Z') + (sequence += 1))
  const expirees = new Set<string>()
  const faux = creerEnvoyeurFaux(expirees)

  const envoyer = (methode: 'POST' | 'DELETE', url: string, payload?: Record<string, unknown>) =>
    s.app.inject({
      method: methode,
      url,
      headers: { cookie, origin: ORIGINE_TEST },
      ...(payload === undefined ? {} : { payload }),
    })
  const abonnements = async () =>
    (
      await bases.pool.query<{ id: string; user_id: string }>(
        'SELECT id, user_id FROM abonnements_push',
      )
    ).rows

  beforeAll(async () => {
    bases = await creerBaseDeTest(URL_SERVEUR_TEST ?? '')
    dossier = await mkdtemp(join(tmpdir(), 'janus-fiches-'))
    const base = baseDepuisPool(bases.db, bases.pool)
    const hacheur = creerHacheur(4)
    userId = nouvelId(Date.parse('2026-09-01T10:00:00.000Z'))
    autreId = nouvelId(Date.parse('2026-09-01T10:00:01.000Z'))
    for (const [id, nom] of [
      [userId, 'amine'],
      [autreId, 'autre'],
    ] as const) {
      await bases.db.insert(t.users).values({
        id,
        nomUtilisateur: nom,
        motDePasseHash: await hacheur.hacher(MOT_DE_PASSE),
        reglages: Reglages.parse({}),
        creeLe: '2026-09-01T10:00:00.000Z',
      })
    }
    s = await serveurDeTest({
      base,
      proprietaire: base,
      hacheur,
      config: configDeTest({ NIVEAU_JOURNAL: 'silent' }),
      correcteur: creerFaux(() => undefined),
      envoyeur: faux.envoyeur,
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
    const reponse = await s.app.inject({
      method: 'POST',
      url: '/api/push/abonnements',
      headers: { origin: ORIGINE_TEST },
      payload: { id: identifiant(), ...ABONNEMENT },
    })
    expect(reponse.statusCode).toBe(401)
  })

  it('donne la clé publique VAPID dans GET /moi', async () => {
    const reponse = await s.app.inject({ method: 'GET', url: '/api/moi', headers: { cookie } })
    expect(reponse.json()).toMatchObject({ cle_vapid: 'publique' })
  })

  describe('abonnements', () => {
    const id = identifiant()

    it('enregistre un abonnement, rejoué sans doublon', async () => {
      const corps = { id, ...ABONNEMENT }

      const premiere = await envoyer('POST', '/api/push/abonnements', corps)
      const rejeu = await envoyer('POST', '/api/push/abonnements', corps)

      expect(premiere.statusCode).toBe(201)
      expect(premiere.json()).toEqual({ id })
      expect(rejeu.json()).toEqual({ id })
      expect(await abonnements()).toEqual([{ id, user_id: userId }])
    })

    it('garde l’identifiant d’une adresse déjà connue', async () => {
      const reponse = await envoyer('POST', '/api/push/abonnements', {
        id: identifiant(),
        ...ABONNEMENT,
        cles: { p256dh: 'nouvelle', auth: 'nouvelle' },
      })

      expect(reponse.json()).toEqual({ id })
      expect(await abonnements()).toHaveLength(1)
    })

    it('refuse un identifiant qui est celui d’un autre (422) et ne supprime pas celui d’un autre', async () => {
      const autre = identifiant()
      await bases.db.insert(t.abonnementsPush).values({
        id: autre,
        userId: autreId,
        endpoint: 'https://push.example.test/autre',
        p256dh: 'x',
        auth: 'y',
        creeLe: '2026-10-01T10:00:00.000Z',
      })

      const pris = await envoyer('POST', '/api/push/abonnements', {
        id: autre,
        endpoint: 'https://push.example.test/troisieme',
        cles: { p256dh: 'x', auth: 'y' },
      })
      const supprime = await envoyer('DELETE', `/api/push/abonnements/${autre}`)

      expect(pris.statusCode).toBe(422)
      expect(supprime.statusCode).toBe(204)
      expect((await abonnements()).map(({ id: ligne }) => ligne)).toContain(autre)
      await bases.db.delete(t.abonnementsPush).where(eq(t.abonnementsPush.id, autre))
    })
  })

  describe('la tâche des rappels', () => {
    beforeAll(async () => {
      // Un bloc vu et une carte notée : elle revient dans quelques jours.
      await bases.db.insert(t.statutsForces).values({
        id: identifiant(),
        userId,
        blocId,
        dateServeur: s.horloge.maintenant(),
        action: 'forcer',
        statut: 'vu',
        raison: 'test',
      })
    })

    it('n’envoie rien tant que rien n’est dû', async () => {
      s.horloge.placer('2026-10-01T17:30:00.000Z')

      const bilan = await s.app.envoyerLesRappels()

      expect(bilan.rappels).toBe(0)
      expect(faux.envois).toHaveLength(0)
    })

    it('n’envoie rien avant l’heure choisie', async () => {
      // Une carte notée à 10 h revient dix minutes plus tard : elle est due, mais il est trop tôt.
      s.horloge.placer('2026-10-05T10:00:00.000Z')
      const connexion = await s.app.inject({
        method: 'POST',
        url: '/api/session',
        headers: { origin: ORIGINE_TEST },
        payload: { nom_utilisateur: 'amine', mot_de_passe: MOT_DE_PASSE },
      })
      cookie = `janus_session=${connexion.cookies[0]?.value ?? ''}`
      const dues = await s.app.inject({
        method: 'GET',
        url: '/api/cartes/dues',
        headers: { cookie },
      })
      const carte = dues.json<{ nouvelles: { id: string }[] }>().nouvelles[0]
      if (carte === undefined) throw new Error('aucune carte')
      const note = await envoyer('POST', `/api/cartes/${encodeURIComponent(carte.id)}/note`, {
        id: identifiant(),
        note: 'bien',
      })
      expect(note.statusCode).toBe(200)
      s.horloge.placer('2026-10-05T16:00:00.000Z')

      expect((await s.app.envoyerLesRappels()).rappels).toBe(0)
      expect(faux.envois).toHaveLength(0)
    })

    it('lancée deux fois en même temps, n’envoie qu’une notification', async () => {
      s.horloge.placer('2026-10-05T17:30:00.000Z')

      await Promise.all([s.app.envoyerLesRappels(), s.app.envoyerLesRappels()])
      await s.app.envoyerLesRappels()

      expect(faux.envois).toHaveLength(1)
      expect(faux.envois[0]).toMatchObject({
        destinataire: { endpoint: ABONNEMENT.endpoint },
        notification: { titre: 'Atelier', corps: '1 carte t’attend' },
      })
      const { rows } = await bases.pool.query<{ jour: string }>(
        'SELECT jour::text FROM rappels_envoyes WHERE user_id = $1',
        [userId],
      )
      expect(rows).toEqual([{ jour: '2026-10-05' }])
    })

    it('n’envoie rien pendant une pause', async () => {
      s.horloge.placer('2026-10-06T17:30:00.000Z')
      await bases.db
        .update(t.users)
        .set({ reglages: Reglages.parse({ rappelsEnPauseJusquAu: '2026-10-06' }) })
        .where(eq(t.users.id, userId))

      expect((await s.app.envoyerLesRappels()).rappels).toBe(0)
      expect(faux.envois).toHaveLength(1)
    })

    it('supprime l’abonnement que le service de push ne connaît plus', async () => {
      s.horloge.placer('2026-10-07T17:30:00.000Z')
      await bases.db
        .update(t.users)
        .set({ reglages: Reglages.parse({}) })
        .where(eq(t.users.id, userId))
      expirees.add(ABONNEMENT.endpoint)

      const bilan = await s.app.envoyerLesRappels()

      expect(bilan).toEqual({ rappels: 1, abonnementsSupprimes: 1, echecs: 0 })
      expect(await abonnements()).toEqual([])
    })
  })
})
