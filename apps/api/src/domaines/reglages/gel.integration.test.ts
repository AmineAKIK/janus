import { nouvelId, Reglages } from '@janus/contrats'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { maintenantDeLaFormation } from '../../base/axeTemps.ts'
import { baseDepuisPool } from '../../base/base.ts'
import * as t from '../../base/schema/index.ts'
import { creerBaseDeTest, URL_SERVEUR_TEST } from '../../base/testeurBase.ts'
import { configDeTest, ORIGINE_TEST, serveurDeTest } from '../../testeur.ts'
import { creerHacheur } from '../auth/composition.ts'

const MOT_DE_PASSE = 'un mot de passe solide'
const T0 = '2026-10-01T10:00:00.000Z'

describe.skipIf(URL_SERVEUR_TEST === undefined)('gel d’une formation contre PostgreSQL', () => {
  let bases: Awaited<ReturnType<typeof creerBaseDeTest>>
  let s: Awaited<ReturnType<typeof serveurDeTest>>
  let cookie = ''
  let userId = ''
  const ids = { dev: nouvelId(1_000), tech: nouvelId(2_000) }

  const connecter = async () => {
    const connexion = await s.app.inject({
      method: 'POST',
      url: '/api/session',
      headers: { origin: ORIGINE_TEST },
      payload: { nom_utilisateur: 'amine', mot_de_passe: MOT_DE_PASSE },
    })
    expect(connexion.statusCode).toBe(200)
    cookie = `__Host-janus_session=${connexion.cookies[0]?.value ?? ''}`
  }
  const choisir = async (formationActive: string) => {
    await connecter()
    const lue = await s.app.inject({ method: 'GET', url: '/api/reglages', headers: { cookie } })
    expect(lue.statusCode).toBe(200)
    return s.app.inject({
      method: 'PATCH',
      url: '/api/reglages',
      headers: { cookie, origin: ORIGINE_TEST, 'if-match': lue.headers['etag'] as string },
      payload: { formationActive },
    })
  }
  const temps = (formationId: string) =>
    maintenantDeLaFormation(bases.db, s.horloge, userId, formationId)

  beforeAll(async () => {
    bases = await creerBaseDeTest(URL_SERVEUR_TEST ?? '')
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
    await bases.db.insert(t.formations).values([
      { id: ids.dev, code: 'DEV', titre: 'Développeur' },
      { id: ids.tech, code: 'TECH', titre: 'Technicien' },
    ])
    await bases.db.insert(t.modules).values([
      {
        id: nouvelId(3_000),
        formationId: ids.dev,
        code: 'M1',
        titre: 'M1',
        ordre: 1,
        importe: true,
      },
      {
        id: nouvelId(4_000),
        formationId: ids.tech,
        code: 'M1',
        titre: 'M1',
        ordre: 1,
        importe: true,
      },
    ])
    s = await serveurDeTest({
      base,
      proprietaire: base,
      hacheur,
      config: configDeTest({ NIVEAU_JOURNAL: 'silent' }),
    })
    s.horloge.placer(T0)
  })
  afterAll(async () => {
    await bases.supprimer()
  })

  it('gèle la formation quittée, et la reprend là où elle s’était arrêtée, en jours entiers', async () => {
    expect((await choisir(ids.tech)).statusCode).toBe(200)

    // Gelée 3 jours et 10 heures : son temps reste au moment du gel.
    s.horloge.placer('2026-10-04T20:00:00.000Z')
    expect(await temps(ids.dev)).toBe(T0)
    expect(await temps(ids.tech)).toBe('2026-10-04T20:00:00.000Z')

    expect((await choisir(ids.dev)).statusCode).toBe(200)
    // Une heure après la reprise : 3 jours rendus, les 10 heures en plus restent comptées.
    s.horloge.placer('2026-10-04T21:00:00.000Z')
    expect(await temps(ids.dev)).toBe('2026-10-01T21:00:00.000Z')
    // C'est maintenant l'autre qui est gelée.
    s.horloge.placer('2026-10-09T21:00:00.000Z')
    expect(await temps(ids.tech)).toBe('2026-10-04T20:00:00.000Z')

    const pauses = await bases.db.select().from(t.pausesFormation)
    expect(pauses.filter(({ fin }) => fin === null)).toHaveLength(1)
  })

  it('choisir la formation déjà active ne gèle rien', async () => {
    const avant = await bases.db.select().from(t.pausesFormation)
    expect((await choisir(ids.dev)).statusCode).toBe(200)
    expect(await bases.db.select().from(t.pausesFormation)).toEqual(avant)
  })
})
