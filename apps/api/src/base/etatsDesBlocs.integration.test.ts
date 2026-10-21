import { Manifeste, Reglages } from '@janus/contrats'
import type { Fait } from '@janus/contrats'
import { calculerBloc } from '@janus/moteur'
import { CAS_ACCEPTATION } from '@janus/moteur/cas-acceptation'
import type { CasStatut } from '@janus/moteur/cas-acceptation'
import { manifesteDuBloc } from '@janus/contrats/demo'
import { drizzle } from 'drizzle-orm/node-postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { baseDepuisPool } from './base.ts'
import type { Base } from './base.ts'
import { ecrireFait } from './ecrireFait.ts'
import { creerCacheDesEtats } from './etatsDesBlocs.ts'
import type { BlocPourEtat, CacheDesEtats } from './etatsDesBlocs.ts'
import { lireFaits } from './faits.ts'
import * as t from './schema/index.ts'
import { creerBaseDeTest, URL_SERVEUR_TEST } from './testeurBase.ts'
import { semerPlan } from './testeurPlan.ts'
import type { PlanSeme } from './testeurPlan.ts'

const TABLES_DES_FAITS = ['evenements', 'corrections', 'statuts_forces', 'decisions_erreurs']

const CAS = CAS_ACCEPTATION.filter(
  (cas): cas is CasStatut => cas.genre === 'statut' && cas.faits.length >= 6,
)
const MAINTENANTS = [
  ...new Set([...CAS.map(({ maintenant }) => maintenant), '2026-01-01T00:00:00.000Z']),
  '2030-01-01T10:00:00.000Z',
]

/** Un fait de chaque sorte, pris dans les cas d'acceptation, pour en écrire d'autres. */
function modele(type: Fait['type']): Fait {
  for (const cas of CAS) {
    const trouve = cas.faits.find((fait) => fait.type === type)
    if (trouve !== undefined) return trouve
  }
  if (type === 'bloc_ouvert') {
    return { id: 'modele', bloc: 'B01', date: MAINTENANTS[0] ?? '', type, horsPrerequis: false }
  }
  throw new Error(`Aucun cas d'acceptation n'a de fait « ${type} »`)
}

describe.skipIf(URL_SERVEUR_TEST === undefined)(
  'états des blocs gardés en mémoire contre PostgreSQL',
  () => {
    let bases: Awaited<ReturnType<typeof creerBaseDeTest>>
    let base: Base
    let plan: PlanSeme
    let blocs: BlocPourEtat[]
    let reglages: Reglages
    let cache: CacheDesEtats
    let tentative = 0
    let compteur = 0
    const requetes: { texte: string; parametres: unknown[] }[] = []
    /** Appelé à chaque requête : un test s'en sert pour agir au moment où une lecture part. */
    let surRequete: (texte: string) => void = () => undefined

    const lecturesDeFaits = () =>
      requetes.filter(
        ({ texte }) =>
          texte.startsWith('select') &&
          !texte.includes('group by') &&
          TABLES_DES_FAITS.some((table) => texte.includes(`from "${table}"`)),
      )
    const signatures = () => requetes.filter(({ texte }) => texte.includes('group by'))

    function blocDe(code: string): BlocPourEtat {
      const bloc = blocs.find((autre) => autre.code === code)
      if (bloc === undefined) throw new Error(`Bloc ${code} inconnu`)
      return bloc
    }
    const manifestes = new Map<string, Manifeste>()

    async function ecrire(code: string, fait: Fait) {
      const bloc = plan.blocs.find((autre) => autre.code === code)
      if (bloc === undefined) throw new Error(`Bloc ${code} inconnu`)
      await ecrireFait(
        {
          db: bases.db,
          userId: plan.userId,
          blocId: bloc.id,
          ficheVersionId: bloc.versionId,
          identifiant: plan.identifiant,
        },
        fait,
        new Map(),
        (tentative += 1),
      )
    }

    /** Un fait de ce type, neuf (identifiant à lui) et daté. */
    const neuf = (type: Fait['type'], date: string): Fait => ({
      ...modele(type),
      id: `neuf-${String((compteur += 1))}`,
      date,
    })

    /** Ce que donne la lecture complète des faits du bloc, sans cache. */
    async function reference(bloc: BlocPourEtat, regles: Reglages, maintenant: string) {
      const faits = await lireFaits(base.db, plan.userId, [bloc])
      const manifeste = manifestes.get(bloc.code)
      if (manifeste === undefined) throw new Error(`Manifeste de ${bloc.code} inconnu`)
      return calculerBloc(faits, manifeste, regles, maintenant)
    }

    async function verifier(
      attendus: readonly BlocPourEtat[] = blocs,
      regles: Reglages = reglages,
    ) {
      const etats = await cache.etats(base.db, plan.userId, attendus, regles)
      expect(new Set(etats.keys())).toEqual(new Set(attendus.map(({ code }) => code)))
      for (const bloc of attendus) {
        const etat = etats.get(bloc.code)
        if (etat === undefined) throw new Error(`Pas d'état pour ${bloc.code}`)
        const lus = await lireFaits(base.db, plan.userId, [bloc])
        const parId = (a: Fait, b: Fait) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
        expect([...etat.faits].sort(parId)).toEqual([...lus].sort(parId))
        expect(etat.dernierFait).toEqual(
          lus.reduce<string | null>((d, f) => (d === null || f.date > d ? f.date : d), null),
        )
        for (const maintenant of MAINTENANTS) {
          expect(etat.resultat(maintenant), `${bloc.code} à ${maintenant}`).toEqual(
            await reference(bloc, regles, maintenant),
          )
        }
      }
      return etats
    }

    beforeAll(async () => {
      bases = await creerBaseDeTest(URL_SERVEUR_TEST ?? '')
      plan = await semerPlan(bases.db, ['B01', 'B02', 'B03', 'B04', 'B05'])
      reglages = Reglages.parse({})
      for (const { code, manifeste } of plan.blocs) manifestes.set(code, manifeste)
      blocs = plan.blocs.map(({ id, code, versionId, manifeste }) => ({
        id,
        code,
        versionId,
        manifeste,
      }))
      // B01 à B04 : un cas d'acceptation chacun ; B05 : aucun fait.
      for (const [rang, bloc] of plan.blocs.slice(0, 4).entries()) {
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
      // Cas piégeux : deux faits à la même date, un fait plus ancien écrit après les autres.
      await ecrire('B01', { ...neuf('bloc_ouvert', '2026-09-15T08:00:00.000Z') })
      await ecrire('B01', { ...neuf('bloc_ouvert', '2026-09-15T08:00:00.000Z') })
      await ecrire('B02', neuf('bloc_ouvert', '2026-01-02T08:00:00.000Z'))
      const db = drizzle(bases.pool, {
        schema: t,
        logger: {
          logQuery: (texte, parametres) => {
            requetes.push({ texte, parametres })
            surRequete(texte)
          },
        },
      })
      base = baseDepuisPool(db, bases.pool)
    })
    afterAll(async () => {
      await bases.supprimer()
    })
    beforeEach(() => {
      cache = creerCacheDesEtats()
      requetes.length = 0
      surRequete = () => undefined
    })

    it('rend, pour chaque bloc et à tout instant, ce que rend calculerBloc sur les faits lus', async () => {
      await verifier()
    })

    it('un bloc sans fait a l’état d’un bloc neuf', async () => {
      const etats = await verifier([blocDe('B05')])
      expect(etats.get('B05')?.faits).toEqual([])
      expect(etats.get('B05')?.dernierFait).toBeNull()
    })

    it('lire plusieurs fois ne relit aucun fait : seule la signature est demandée', async () => {
      await cache.etats(base.db, plan.userId, blocs, reglages)
      requetes.length = 0
      const une = await cache.etats(base.db, plan.userId, blocs, reglages)
      const autre = await cache.etats(base.db, plan.userId, blocs, reglages)
      expect(lecturesDeFaits()).toEqual([])
      expect(signatures()).toHaveLength(8)
      expect(autre.get('B02')).toBe(une.get('B02'))
    })

    it('rappeler resultat() à d’autres instants ne change pas ce qu’il rend', async () => {
      const etats = await cache.etats(base.db, plan.userId, blocs, reglages)
      const etat = etats.get('B01')
      if (etat === undefined) throw new Error('Pas d’état')
      const avant = MAINTENANTS.map((m) => etat.resultat(m))
      const apres = [...MAINTENANTS].reverse().map((m) => etat.resultat(m))
      expect(apres.reverse()).toEqual(avant)
    })

    it.each([
      ['un événement', 'bloc_ouvert'],
      ['une correction', 'correction'],
      ['un statut forcé', 'statut_force'],
      ['une décision sur une erreur', 'erreur_cochee'],
      ['une vérification terminée', 'verification_terminee'],
    ] as const)('%s ajouté change le bloc, et lui seul est relu', async (_nom, type) => {
      await verifier()
      await ecrire('B03', neuf(type, '2026-10-20T09:00:00.000Z'))
      requetes.length = 0
      const etats = await cache.etats(base.db, plan.userId, blocs, reglages)
      expect(etats.get('B03')?.faits.some((fait) => fait.type === type)).toBe(true)
      const lectures = lecturesDeFaits()
      expect(lectures.length).toBeGreaterThan(0)
      for (const { parametres } of lectures) {
        expect(parametres).toContain(blocDe('B03').id)
        expect(parametres).not.toContain(blocDe('B01').id)
        expect(parametres).not.toContain(blocDe('B02').id)
      }
      await verifier()
    })

    it('un fait plus ancien que tous les autres, ajouté après, est vu (le nombre de faits change)', async () => {
      await verifier()
      await ecrire('B04', neuf('bloc_ouvert', '2020-01-01T00:00:00.000Z'))
      await verifier()
    })

    it('un fait à la date du dernier est vu', async () => {
      const etats = await verifier()
      const dernier = etats.get('B02')?.dernierFait
      if (dernier === null || dernier === undefined) throw new Error('B02 sans fait')
      await ecrire('B02', neuf('correction', dernier))
      await verifier()
    })

    it('d’autres réglages donnent d’autres états, recalculés', async () => {
      await verifier()
      const autres = Reglages.parse({
        delaiVerificationJours: 14,
        heureBascule: 0,
      })
      requetes.length = 0
      await verifier(blocs, autres)
      expect(lecturesDeFaits().length).toBeGreaterThan(0)
      // Et revenir aux premiers rend les premiers.
      await verifier(blocs, reglages)
    })

    it('une autre version de fiche donne un autre état, recalculé', async () => {
      await verifier()
      const autre: BlocPourEtat = {
        ...blocDe('B02'),
        versionId: 'une-autre-version',
        manifeste: manifesteDuBloc({
          code: 'B02',
          titre: 'Autre titre',
          prerequis: [],
          partie: 'P9',
        }),
      }
      const etats = await cache.etats(base.db, plan.userId, [autre], reglages)
      expect(etats.get('B02')?.manifeste).toEqual(autre.manifeste)
      const lus = await lireFaits(base.db, plan.userId, [autre])
      const manifeste = Manifeste.parse(autre.manifeste)
      for (const maintenant of MAINTENANTS) {
        expect(etats.get('B02')?.resultat(maintenant)).toEqual(
          calculerBloc(lus, manifeste, reglages, maintenant),
        )
      }
    })

    it('deux demandes simultanées ne lisent les faits qu’une fois', async () => {
      await Promise.all([
        cache.etats(base.db, plan.userId, blocs, reglages),
        cache.etats(base.db, plan.userId, blocs, reglages),
        cache.etats(base.db, plan.userId, blocs, reglages),
      ])
      // Au plus une lecture par table, pour tous les blocs.
      expect(lecturesDeFaits().length).toBeLessThanOrEqual(TABLES_DES_FAITS.length)
    })

    it('par petits lots, le résultat est le même', async () => {
      const petit = creerCacheDesEtats({ faitsParLot: 1 })
      const etats = await petit.etats(base.db, plan.userId, blocs, reglages)
      for (const bloc of blocs) {
        const lus = await lireFaits(base.db, plan.userId, [bloc])
        expect(etats.get(bloc.code)?.faits.length).toBe(lus.length)
        expect(etats.get(bloc.code)?.resultat(MAINTENANTS[0] ?? '')).toEqual(
          await reference(bloc, reglages, MAINTENANTS[0] ?? ''),
        )
      }
      // Un lot par bloc au plus : autant de lectures que de blocs avec des faits.
      expect(lecturesDeFaits().length).toBeGreaterThan(TABLES_DES_FAITS.length)
    })

    it('la mémoire est bornée : les blocs les moins récemment lus sont oubliés, et relus à l’usage', async () => {
      const total = (await Promise.all(blocs.map((b) => lireFaits(base.db, plan.userId, [b]))))
        .map((faits) => faits.length)
        .reduce((a, b) => a + b, 0)
      const etroit = creerCacheDesEtats({ faitsMax: Math.floor(total / 2), faitsParLot: 1 })
      await etroit.etats(base.db, plan.userId, blocs, reglages)
      requetes.length = 0
      const etats = await etroit.etats(base.db, plan.userId, blocs, reglages)
      // Tout n'a pas pu être gardé : des blocs ont été relus…
      expect(lecturesDeFaits().length).toBeGreaterThan(0)
      // …mais rien n'est faux.
      for (const bloc of blocs) {
        expect(etats.get(bloc.code)?.resultat(MAINTENANTS[0] ?? '')).toEqual(
          await reference(bloc, reglages, MAINTENANTS[0] ?? ''),
        )
      }
    })

    it('un signal déjà interrompu ne lit rien', async () => {
      const arret = new AbortController()
      arret.abort(new Error('délai écoulé'))
      await expect(
        cache.etats(base.db, plan.userId, blocs, reglages, arret.signal),
      ).rejects.toThrow('délai écoulé')
      expect(requetes).toEqual([])
    })

    it('un signal interrompu pendant la relecture arrête les lots suivants', async () => {
      const petit = creerCacheDesEtats({ faitsParLot: 1 })
      const arret = new AbortController()
      surRequete = (texte) => {
        if (texte.startsWith('select') && !texte.includes('group by')) {
          arret.abort(new Error('délai écoulé'))
        }
      }
      await expect(
        petit.etats(base.db, plan.userId, blocs, reglages, arret.signal),
      ).rejects.toThrow('délai écoulé')
      // Un seul lot a été lu (au plus une lecture par table), pas les quatre blocs garnis.
      expect(lecturesDeFaits().length).toBeLessThanOrEqual(TABLES_DES_FAITS.length)
      // Et le cache n'en est pas abîmé.
      surRequete = () => undefined
      await verifier()
    })

    it('vider oublie tout', async () => {
      await cache.etats(base.db, plan.userId, blocs, reglages)
      cache.vider()
      requetes.length = 0
      await cache.etats(base.db, plan.userId, blocs, reglages)
      expect(lecturesDeFaits().length).toBeGreaterThan(0)
    })

    it('une lecture qui échoue n’empoisonne pas le cache', async () => {
      const casse = baseDepuisPool(
        drizzle(bases.pool, {
          schema: t,
          logger: {
            logQuery: (texte) => {
              if (texte.startsWith('select') && texte.includes('from "corrections"')) {
                if (!texte.includes('group by')) throw new Error('lecture cassée')
              }
            },
          },
        }),
        bases.pool,
      )
      await expect(cache.etats(casse.db, plan.userId, blocs, reglages)).rejects.toThrow()
      await verifier()
    })
  },
)
