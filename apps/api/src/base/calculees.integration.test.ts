import { nouvelId } from '@janus/contrats'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as t from './schema/index.ts'
import { TABLES_CALCULEES } from './schema/index.ts'
import { creerBaseDeTest, URL_SERVEUR_TEST } from './testeurBase.ts'

const DATE = '2026-10-01T10:00:00.000Z'
let numero = 0
const id = () => nouvelId(Date.parse(DATE) + (numero += 1))

describe.skipIf(URL_SERVEUR_TEST === undefined)('schéma : les tables calculées', () => {
  let base: Awaited<ReturnType<typeof creerBaseDeTest>>
  let userId = ''

  beforeAll(async () => {
    base = await creerBaseDeTest(URL_SERVEUR_TEST ?? '')
    userId = id()
    await base.db.insert(t.users).values({
      id: userId,
      nomUtilisateur: 'amine',
      motDePasseHash: 'h',
      reglages: {},
      creeLe: DATE,
    })
  })
  afterAll(async () => {
    await base.supprimer()
  })

  async function refus(requete: Promise<unknown>) {
    const erreur: unknown = await requete.then(
      () => null,
      (e: unknown) => e,
    )
    if (erreur === null) throw new Error('La base a accepté la ligne.')
    const cause = erreur instanceof Error && erreur.cause !== undefined ? erreur.cause : erreur
    if (typeof cause !== 'object' || cause === null) throw new Error('Erreur inattendue.')
    return {
      code: 'code' in cause ? cause.code : undefined,
      contrainte: 'constraint' in cause ? cause.constraint : undefined,
    }
  }

  async function commeApp(texte: string) {
    const client = await base.pool.connect()
    try {
      await client.query('SET ROLE janus_app')
      return await client.query(texte)
    } finally {
      await client.query('RESET ROLE')
      client.release()
    }
  }

  const budget = (surcharge: Partial<typeof t.budgetIa.$inferInsert> = {}) => ({
    userId,
    mois: '2026-10',
    plafondMillioniemes: 1000,
    consommeMillioniemes: 100,
    reserveMillioniemes: 50,
    ...surcharge,
  })

  it('crée les index qui servent aux écrans « à faire » et aux révisions', async () => {
    const { rows } = await base.pool.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes WHERE indexname IN ('echeances_a_faire', 'revues_fsrs_due')`,
    )
    const parNom = new Map(rows.map((ligne) => [ligne.indexname, ligne.indexdef]))

    expect(parNom.get('echeances_a_faire')).toContain('(user_id, due_le)')
    expect(parNom.get('echeances_a_faire')).toContain('WHERE (faite_le IS NULL)')
    expect(parNom.get('revues_fsrs_due')).toContain('(user_id, due_le)')
  })

  it('range le budget par utilisateur et par mois, et refuse un mois mal écrit', async () => {
    await base.db.insert(t.budgetIa).values(budget())

    const doublon = await refus(base.db.insert(t.budgetIa).values(budget()))
    const mois = await refus(base.db.insert(t.budgetIa).values(budget({ mois: '2026-13' })))

    expect(doublon.code).toBe('23505')
    expect(mois.contrainte).toBe('budget_ia_mois')
  })

  it('refuse un budget négatif ou dépassé par la consommation et la réserve', async () => {
    const negatif = await refus(
      base.db.insert(t.budgetIa).values(budget({ mois: '2026-11', reserveMillioniemes: -1 })),
    )
    const depasse = await refus(
      base.db
        .insert(t.budgetIa)
        .values(budget({ mois: '2026-12', consommeMillioniemes: 900, reserveMillioniemes: 200 })),
    )

    expect(negatif.contrainte).toBe('budget_ia_montants')
    expect(depasse.contrainte).toBe('budget_ia_plafond')
  })

  it('refuse deux abonnements push au même endpoint', async () => {
    const abonnement = () => ({
      id: id(),
      userId,
      endpoint: 'https://push.example.org/a',
      p256dh: 'k',
      auth: 'a',
      creeLe: DATE,
    })
    await base.db.insert(t.abonnementsPush).values(abonnement())

    const doublon = await refus(base.db.insert(t.abonnementsPush).values(abonnement()))

    expect(doublon.contrainte).toBe('abonnements_push_endpoint')
  })

  it('laisse le rôle de l’appli tout faire sur les tables calculées, sauf effacer le budget', async () => {
    for (const table of TABLES_CALCULEES) {
      const { rows } = await base.pool.query<{ p: string }>(
        `SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) AS p FROM information_schema.role_table_grants WHERE grantee = 'janus_app' AND table_name = '${table}'`,
      )
      expect(rows[0]?.p, table).toBe(
        table === 'budget_ia' ? 'INSERT,SELECT,UPDATE' : 'DELETE,INSERT,SELECT,UPDATE',
      )
    }
    const suppression = await refus(commeApp(`DELETE FROM budget_ia`))
    expect(suppression.code).toBe('42501')
  })
})
