import { Reglages } from '@janus/contrats'
import { composerExport, composerJournal } from '@janus/moteur'
import type { BlocImporte } from '@janus/moteur'
import { CAS_ACCEPTATION } from '@janus/moteur/cas-acceptation'
import type { CasStatut } from '@janus/moteur/cas-acceptation'
import { drizzle } from 'drizzle-orm/node-postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { baseDepuisPool } from '../../base/base.ts'
import { ecrireFait } from '../../base/ecrireFait.ts'
import { creerCacheDesEtats } from '../../base/etatsDesBlocs.ts'
import { lireFaits } from '../../base/faits.ts'
import * as t from '../../base/schema/index.ts'
import { creerBaseDeTest, URL_SERVEUR_TEST } from '../../base/testeurBase.ts'
import { semerPlan } from '../../base/testeurPlan.ts'
import type { PlanSeme } from '../../base/testeurPlan.ts'
import { horlogeFausse } from '../../testeur.ts'
import { creerDepotSuivi } from './depot.ts'
import { creerServiceSuivi } from './service.ts'

const MAINTENANT = '2026-12-05T10:00:00.000Z'
const CAS = CAS_ACCEPTATION.filter(
  (cas): cas is CasStatut => cas.genre === 'statut' && cas.faits.length >= 6,
).slice(0, 5)
const TABLES_DES_FAITS = ['evenements', 'corrections', 'statuts_forces', 'decisions_erreurs']

describe.skipIf(URL_SERVEUR_TEST === undefined)(
  'journal et export texte depuis les états gardés',
  () => {
    let bases: Awaited<ReturnType<typeof creerBaseDeTest>>
    let plan: PlanSeme
    let service: ReturnType<typeof creerServiceSuivi>
    const lectures: string[] = []
    const faitsLus = () =>
      lectures.filter(
        (texte) =>
          texte.startsWith('select') &&
          !texte.includes('group by') &&
          TABLES_DES_FAITS.some((table) => texte.includes(`from "${table}"`)),
      )

    beforeAll(async () => {
      bases = await creerBaseDeTest(URL_SERVEUR_TEST ?? '')
      plan = await semerPlan(
        bases.db,
        CAS.map((_, rang) => `B0${String(rang + 1)}`),
      )
      let tentative = 0
      for (const [rang, bloc] of plan.blocs.entries()) {
        const ids = new Map<string, string>()
        for (const fait of CAS[rang]?.faits ?? []) {
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
      const db = drizzle(bases.pool, {
        schema: t,
        logger: {
          logQuery: (texte) => {
            lectures.push(texte)
          },
        },
      })
      service = creerServiceSuivi({
        base: baseDepuisPool(db, bases.pool),
        depot: creerDepotSuivi(),
        horloge: horlogeFausse(MAINTENANT),
        aujourdhui: () => Promise.reject(new Error('inutilisé')),
        etats: creerCacheDesEtats(),
      })
    })
    afterAll(async () => {
      await bases.supprimer()
    })

    async function attendus() {
      const faits = await lireFaits(
        bases.db,
        plan.userId,
        plan.blocs.map(({ id, code }) => ({ id, code })),
      )
      const blocs: BlocImporte[] = plan.blocs.map(({ code, manifeste }) => ({
        code,
        moduleCode: 'M1',
        partie: '',
        manifeste,
      }))
      const reglages = Reglages.parse({})
      return {
        journal: composerJournal({
          modules: [{ id: 'M1', titre: 'Module' }],
          blocs,
          faits,
          reglages,
          maintenant: MAINTENANT,
          requete: {},
          notes: [],
          idees: [],
        }),
        export: composerExport({
          blocs,
          faits,
          reglages,
          tachesReservees: [],
          idees: [],
          derniereRevue: null,
        }),
      }
    }

    it('rendent ce que rendent le journal et l’export composés sur tous les faits lus', async () => {
      const attendu = await attendus()
      expect(attendu.journal.entrees.length).toBeGreaterThan(5)

      expect(await service.journal(plan.userId, {})).toEqual(attendu.journal)
      expect(await service.exportTexte(plan.userId)).toBe(attendu.export)
    })

    it('sans nouveau fait, une seconde lecture ne relit aucun fait', async () => {
      await service.journal(plan.userId, {})
      lectures.length = 0
      await service.journal(plan.userId, {})
      await service.exportTexte(plan.userId)
      expect(faitsLus()).toEqual([])
    })
  },
)
