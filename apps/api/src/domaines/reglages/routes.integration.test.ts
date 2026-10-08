import { nouvelId, Reglages } from '@janus/contrats'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { baseDepuisPool } from '../../base/base.ts'
import * as t from '../../base/schema/index.ts'
import { creerBaseDeTest, URL_SERVEUR_TEST } from '../../base/testeurBase.ts'
import { configDeTest, ORIGINE_TEST, serveurDeTest } from '../../testeur.ts'
import { creerHacheur } from '../auth/composition.ts'

const MOT_DE_PASSE = 'un mot de passe solide'

describe.skipIf(URL_SERVEUR_TEST === undefined)('réglages contre PostgreSQL', () => {
  let bases: Awaited<ReturnType<typeof creerBaseDeTest>>
  let s: Awaited<ReturnType<typeof serveurDeTest>>
  let cookie = ''

  const lire = () => s.app.inject({ method: 'GET', url: '/api/reglages', headers: { cookie } })
  const modifier = (corps: Record<string, unknown>, ifMatch?: string) =>
    s.app.inject({
      method: 'PATCH',
      url: '/api/reglages',
      headers: {
        cookie,
        origin: ORIGINE_TEST,
        ...(ifMatch === undefined ? {} : { 'if-match': ifMatch }),
      },
      payload: corps,
    })

  beforeAll(async () => {
    bases = await creerBaseDeTest(URL_SERVEUR_TEST ?? '')
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
  })

  it('exige une connexion', async () => {
    expect((await s.app.inject({ method: 'GET', url: '/api/reglages' })).statusCode).toBe(401)
    expect(
      (
        await s.app.inject({
          method: 'PATCH',
          url: '/api/reglages',
          headers: { origin: ORIGINE_TEST },
          payload: {},
        })
      ).statusCode,
    ).toBe(401)
  })

  it('rend les réglages avec un ETag', async () => {
    const reponse = await lire()

    expect(reponse.statusCode).toBe(200)
    expect(reponse.headers['etag']).toBe('"1"')
    expect(reponse.json()).toEqual(Reglages.parse({}))
  })

  it('refuse un changement sans If-Match (412)', async () => {
    const reponse = await modifier({ questionsDebut: 8 })

    expect(reponse.statusCode).toBe(412)
    expect(reponse.json<{ code: string }>().code).toBe('precondition_echouee')
    expect((await lire()).json<{ questionsDebut: number }>().questionsDebut).toBe(
      Reglages.parse({}).questionsDebut,
    )
  })

  it('change seulement les réglages donnés et passe à la version suivante', async () => {
    const avant = Reglages.parse({})

    const reponse = await modifier({ questionsDebut: 8 }, '"1"')

    expect(reponse.statusCode).toBe(200)
    expect(reponse.json()).toEqual({ ...avant, questionsDebut: 8 })
    const relue = await lire()
    expect(relue.headers['etag']).toBe('"2"')
    expect(relue.json()).toEqual({ ...avant, questionsDebut: 8 })
  })

  it('deux changements avec le même If-Match : le second reçoit 412 et n’écrit rien', async () => {
    const premier = await modifier({ nouvellesCartesParJour: 7 }, '"2"')
    const second = await modifier({ nouvellesCartesParJour: 9 }, '"2"')

    expect(premier.statusCode).toBe(200)
    expect(second.statusCode).toBe(412)
    expect((await lire()).json<{ nouvellesCartesParJour: number }>().nouvellesCartesParJour).toBe(7)
  })

  it('deux changements simultanés avec le même If-Match : un seul passe', async () => {
    const version = (await lire()).headers['etag'] as string

    const reponses = await Promise.all([
      modifier({ relancesMax: 2 }, version),
      modifier({ relancesMax: 3 }, version),
    ])

    expect(reponses.map(({ statusCode }) => statusCode).sort()).toEqual([200, 412])
  })

  it('refuse les règles de la méthode (403) et les valeurs hors bornes (400)', async () => {
    const version = (await lire()).headers['etag'] as string

    expect((await modifier({ delaiRetestJours: 30 }, version)).statusCode).toBe(403)
    expect((await modifier({ questionsDebut: 999 }, version)).statusCode).toBe(400)
    expect((await modifier({ inconnu: 1 }, version)).statusCode).toBe(400)
    expect((await lire()).headers['etag']).toBe(version)
  })
})
