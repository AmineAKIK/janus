import { nouvelId, Reglages } from '@janus/contrats'
import { CAS_ACCEPTATION } from '@janus/moteur/cas-acceptation'
import type { CasStatut } from '@janus/moteur/cas-acceptation'
import { drizzle } from 'drizzle-orm/node-postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerFaux } from '../../adaptateurs/correcteur/faux.ts'
import { baseDepuisPool } from '../../base/base.ts'
import { ecrireFait } from '../../base/ecrireFait.ts'
import { creerCacheDesEtats } from '../../base/etatsDesBlocs.ts'
import { lireFaits } from '../../base/faits.ts'
import * as t from '../../base/schema/index.ts'
import { creerBaseDeTest, URL_SERVEUR_TEST } from '../../base/testeurBase.ts'
import { semerPlan } from '../../base/testeurPlan.ts'
import type { PlanSeme } from '../../base/testeurPlan.ts'
import { configDeTest, ORIGINE_TEST, serveurDeTest } from '../../testeur.ts'
import { creerHacheur } from '../auth/composition.ts'
import { creerDepotRevisions } from './depot.ts'
import { contexteDepuisEtats, contexteDuJour } from './policy.ts'
import { creerServiceRevisions } from './service.ts'

const MOT_DE_PASSE = 'un mot de passe solide'
const TABLES_DES_FAITS = ['evenements', 'corrections', 'statuts_forces', 'decisions_erreurs']

/** Les cas d'acceptation du cadrage qui fournissent des faits à plusieurs blocs. */
const CAS = CAS_ACCEPTATION.filter(
  (cas): cas is CasStatut => cas.genre === 'statut' && cas.faits.length >= 8,
).slice(0, 6)

describe.skipIf(URL_SERVEUR_TEST === undefined)('lectures de la séance contre PostgreSQL', () => {
  let bases: Awaited<ReturnType<typeof creerBaseDeTest>>
  let s: Awaited<ReturnType<typeof serveurDeTest>>
  let plan: PlanSeme
  let service: ReturnType<typeof creerServiceRevisions>
  let cookie = ''
  const requetes: { texte: string; parametres: unknown[] }[] = []

  /** Les lectures de faits (une par table) faites pendant `action`, avec les blocs qu'elles visent. */
  async function lecturesDeFaits(action: () => Promise<unknown>) {
    requetes.length = 0
    await action()
    const idsDuPlan = new Set(plan.blocs.map(({ id }) => id))
    return requetes
      .filter(({ texte }) =>
        TABLES_DES_FAITS.some(
          (table) => texte.startsWith('select') && texte.includes(`from "${table}"`),
        ),
      )
      .filter(
        ({ texte }) =>
          !texte.includes('"verification"') &&
          !texte.includes('->>') &&
          !texte.includes('group by'),
      )
      .map(({ texte, parametres }) => ({
        table: TABLES_DES_FAITS.find((table) => texte.includes(`from "${table}"`)),
        blocs: parametres.filter((p): p is string => typeof p === 'string' && idsDuPlan.has(p)),
        parametres,
      }))
  }

  beforeAll(async () => {
    bases = await creerBaseDeTest(URL_SERVEUR_TEST ?? '')
    plan = await semerPlan(bases.db, ['B01', 'B02', 'B03', 'B04'])
    const hacheur = creerHacheur(4)
    await bases.db
      .update(t.users)
      .set({ nomUtilisateur: 'amine', motDePasseHash: await hacheur.hacher(MOT_DE_PASSE) })
    // Des faits réalistes sur chaque bloc : les cas d'acceptation du cadrage, rejoués bloc par bloc.
    let tentative = 0
    for (const [rang, bloc] of plan.blocs.entries()) {
      const cas = CAS[rang % CAS.length]
      if (cas === undefined) continue
      const ids = new Map<string, string>()
      for (const fait of cas.faits) {
        await ecrireFait(
          {
            db: bases.db,
            userId: plan.userId,
            blocId: bloc.id,
            ficheVersionId: bloc.versionId,
            identifiant: plan.identifiant,
          },
          fait,
          ids,
          (tentative += 1),
        )
      }
    }
    // Une base dont Drizzle note chaque requête, pour voir ce que les routes lisent.
    const db = drizzle(bases.pool, {
      schema: t,
      logger: {
        logQuery: (texte, parametres) => {
          requetes.push({ texte, parametres })
        },
      },
    })
    const base = baseDepuisPool(db, bases.pool)
    s = await serveurDeTest({
      base,
      proprietaire: base,
      hacheur,
      config: configDeTest({ NIVEAU_JOURNAL: 'silent' }),
      correcteur: creerFaux(() => undefined),
    })
    s.horloge.placer('2026-10-01T10:00:00.000Z')
    service = creerServiceRevisions({
      base,
      depot: creerDepotRevisions(),
      horloge: s.horloge,
      corrigerPartie: () => Promise.reject(new Error('inutilisé')),
    })
    const connexion = await s.app.inject({
      method: 'POST',
      url: '/api/session',
      headers: { origin: ORIGINE_TEST },
      payload: { nom_utilisateur: 'amine', mot_de_passe: MOT_DE_PASSE },
    })
    cookie = `__Host-janus_session=${connexion.cookies[0]?.value ?? ''}`
  })
  afterAll(async () => {
    await bases.supprimer()
  })

  it('le plan de test a des faits sur plusieurs blocs', async () => {
    const lignes = await bases.db.select({ blocId: t.evenements.blocId }).from(t.evenements)
    expect(new Set(lignes.map(({ blocId }) => blocId)).size).toBeGreaterThanOrEqual(3)
  })

  it('ouvrir une vérification ne lit que les vérifications terminées, jamais les autres faits', async () => {
    const lectures = await lecturesDeFaits(() =>
      service.verificationPour(plan.userId, 'B02', 'verification'),
    )

    expect(lectures.map(({ table }) => table)).toEqual(['evenements'])
    expect(lectures[0]?.parametres).toContain('verification_terminee')
    expect(lectures[0]?.parametres).not.toContain('etape_vue')
  })

  it('lire une vérification ne lit que les faits de son bloc', async () => {
    const id = await service.verificationPour(plan.userId, 'B02', 'verification')

    const lectures = await lecturesDeFaits(async () => {
      const reponse = await s.app.inject({
        method: 'GET',
        url: `/api/verifications/${id}`,
        headers: { cookie },
      })
      expect(reponse.statusCode).toBe(200)
    })

    expect(lectures.length).toBeGreaterThan(0)
    const blocB02 = plan.blocs.find(({ code }) => code === 'B02')?.id
    for (const lecture of lectures) expect(lecture.blocs).toEqual([blocB02])
  })

  it('reporter ou répondre à une vérification ne lit aucun fait', async () => {
    const id = await service.verificationPour(plan.userId, 'B03', 'verification')

    const lectures = await lecturesDeFaits(async () => {
      const reponse = await s.app.inject({
        method: 'POST',
        url: `/api/verifications/${id}/reporter`,
        headers: { cookie, origin: ORIGINE_TEST },
        payload: { id: nouvelId(Date.parse('2026-10-01T10:00:00.000Z') + 1) },
      })
      expect(reponse.statusCode).toBe(200)
    })

    expect(lectures).toEqual([])
  })

  it('Aujourd’hui ne relit que les blocs qui ont changé depuis la lecture précédente', async () => {
    await service.aujourdhui(plan.userId)
    const inchange = await lecturesDeFaits(() => service.aujourdhui(plan.userId))
    expect(inchange).toEqual([])

    const bloc = plan.blocs.find(({ code }) => code === 'B04')
    if (bloc === undefined) throw new Error('B04 absent')
    await ecrireFait(
      {
        db: bases.db,
        userId: plan.userId,
        blocId: bloc.id,
        ficheVersionId: bloc.versionId,
        identifiant: plan.identifiant,
      },
      {
        id: 'ouverture-neuve',
        bloc: 'B04',
        date: '2026-10-01T09:00:00.000Z',
        type: 'bloc_ouvert',
        horsPrerequis: false,
      },
      new Map(),
      1_000,
    )
    const change = await lecturesDeFaits(() => service.aujourdhui(plan.userId))
    expect(change.length).toBeGreaterThan(0)
    for (const lecture of change) expect(lecture.blocs).toEqual([bloc.id])
  })

  it('le contexte du jour tiré des états gardés est celui que donne la lecture de tous les faits', async () => {
    const reglages = Reglages.parse({})
    const blocs = plan.blocs.map(({ id, code, versionId, manifeste }) => ({
      id,
      code,
      versionId,
      manifeste,
    }))
    const cache = creerCacheDesEtats()
    const duPlan = plan.blocs.map(({ id, code, manifeste }) => ({
      id,
      code,
      moduleId: 'M',
      moduleCode: 'M1',
      moduleTitre: 'Module',
      manifeste,
    }))
    const faits = await lireFaits(
      bases.db,
      plan.userId,
      plan.blocs.map(({ id, code }) => ({ id, code })),
    )
    for (const maintenant of ['2026-10-01T10:00:00.000Z', '2026-12-15T10:00:00.000Z']) {
      const etats = await cache.etats(bases.db, plan.userId, blocs, reglages)
      expect(contexteDepuisEtats(duPlan, etats, reglages, maintenant)).toEqual(
        contexteDuJour(duPlan, faits, reglages, maintenant),
      )
    }
  })
})
