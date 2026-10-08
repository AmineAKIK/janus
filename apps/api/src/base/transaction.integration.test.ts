import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerBaseDeTest, URL_SERVEUR_TEST } from './testeurBase.ts'
import { creerTransaction, REJEUX_MAX, verrouBloc } from './transaction.ts'
import type { Transaction } from './transaction.ts'

const attendre = (ms: number) => new Promise((resolu) => setTimeout(resolu, ms))

/** Un point de rendez-vous : chacun attend l'autre avant de continuer. */
function rendezVous(participants: number) {
  let arrives = 0
  let ouvrir: () => void = () => undefined
  const ouvert = new Promise<void>((resolu) => {
    ouvrir = resolu
  })
  return async () => {
    arrives += 1
    if (arrives >= participants) ouvrir()
    await ouvert
  }
}

describe.skipIf(URL_SERVEUR_TEST === undefined)('transaction', () => {
  let base: Awaited<ReturnType<typeof creerBaseDeTest>>
  const rejeux: [number, string][] = []
  let outil: Transaction | undefined
  const transaction: Transaction = (fn) => {
    if (outil === undefined) throw new Error('La base de test n’est pas prête.')
    return outil(fn)
  }

  beforeAll(async () => {
    base = await creerBaseDeTest(URL_SERVEUR_TEST ?? '')
    outil = creerTransaction({
      db: base.db,
      surRejeu: (rejeu, code) => rejeux.push([rejeu, code]),
    })
    await base.pool.query('CREATE TABLE essai (id int PRIMARY KEY, v int NOT NULL)')
    await base.pool.query('INSERT INTO essai VALUES (1, 0), (2, 0)')
  })
  afterAll(async () => {
    await base.supprimer()
  })

  it('valide la transaction et rend la valeur de la fonction', async () => {
    const valeur = await transaction(async (tx) => {
      await tx.execute(sql`UPDATE essai SET v = 7 WHERE id = 1`)
      return 'fait'
    })

    const { rows } = await base.pool.query<{ v: number }>('SELECT v FROM essai WHERE id = 1')
    expect(valeur).toBe('fait')
    expect(rows[0]?.v).toBe(7)
  })

  it('annule tout quand la fonction échoue, et ne rejoue pas une erreur ordinaire', async () => {
    let essais = 0

    await expect(
      transaction(async (tx) => {
        essais += 1
        await tx.execute(sql`UPDATE essai SET v = 99 WHERE id = 2`)
        throw new Error('raté')
      }),
    ).rejects.toThrow('raté')

    const { rows } = await base.pool.query<{ v: number }>('SELECT v FROM essai WHERE id = 2')
    expect(essais).toBe(1)
    expect(rows[0]?.v).toBe(0)
  })

  it('travaille en READ COMMITTED', async () => {
    const niveau = await transaction(async (tx) => {
      const resultat = await tx.execute<{ transaction_isolation: string }>(
        sql`SHOW transaction_isolation`,
      )
      return resultat.rows[0]?.transaction_isolation
    })

    expect(niveau).toBe('read committed')
  })

  it('rejoue après un échec de sérialisation (40001), puis réussit', async () => {
    rejeux.length = 0
    let essais = 0

    const valeur = await transaction((): Promise<string> => {
      essais += 1
      if (essais === 1)
        return Promise.reject(Object.assign(new Error('sérialisation'), { code: '40001' }))
      return Promise.resolve('réussi')
    })

    expect(valeur).toBe('réussi')
    expect(essais).toBe(2)
    expect(rejeux).toEqual([[1, '40001']])
  })

  it('abandonne après 3 rejeux et rend l’erreur', async () => {
    rejeux.length = 0
    let essais = 0

    await expect(
      transaction((): Promise<never> => {
        essais += 1
        return Promise.reject(Object.assign(new Error('interblocage'), { code: '40P01' }))
      }),
    ).rejects.toThrow('interblocage')

    expect(essais).toBe(REJEUX_MAX + 1)
    expect(rejeux.map(([numero]) => numero)).toEqual([1, 2, 3])
  })

  it('rejoue une transaction en interblocage réelle (deux connexions) et les deux réussissent', async () => {
    rejeux.length = 0
    const barriere = rendezVous(2)
    let premiereTentative = true
    const croiser = (premier: number, second: number) =>
      transaction(async (tx) => {
        await tx.execute(sql`UPDATE essai SET v = v + 1 WHERE id = ${premier}`)
        if (premiereTentative) await barriere()
        await tx.execute(sql`UPDATE essai SET v = v + 1 WHERE id = ${second}`)
      })
    // Le rendez-vous ne vaut que pour la première tentative : le rejeu ne doit plus attendre.
    const a = croiser(1, 2)
    const b = croiser(2, 1)
    setTimeout(() => {
      premiereTentative = false
    }, 3000)

    await Promise.all([a, b])

    expect(rejeux.some(([, code]) => code === '40P01')).toBe(true)
  })

  describe('verrouBloc', () => {
    it('fait passer l’un après l’autre deux recalculs du même utilisateur et du même bloc', async () => {
      const ordre: string[] = []
      const tenir = (nom: string, userId: string, blocId: string) =>
        transaction(async (tx) => {
          await verrouBloc(tx, userId, blocId)
          ordre.push(`${nom} commence`)
          await attendre(300)
          ordre.push(`${nom} finit`)
        })

      const premier = tenir('A', 'user-1', 'bloc-1')
      await attendre(50)
      const second = tenir('B', 'user-1', 'bloc-1')
      await Promise.all([premier, second])

      expect(ordre).toEqual(['A commence', 'A finit', 'B commence', 'B finit'])
    })

    it('laisse passer en parallèle deux blocs différents, et deux utilisateurs différents', async () => {
      const ordre: string[] = []
      const tenir = (nom: string, userId: string, blocId: string) =>
        transaction(async (tx) => {
          await verrouBloc(tx, userId, blocId)
          ordre.push(`${nom} commence`)
          await attendre(300)
          ordre.push(`${nom} finit`)
        })

      await Promise.all([
        tenir('A', 'user-1', 'bloc-1'),
        tenir('B', 'user-1', 'bloc-2'),
        tenir('C', 'user-2', 'bloc-1'),
      ])

      expect(ordre.slice(0, 3).sort()).toEqual(['A commence', 'B commence', 'C commence'])
    })

    it('relâche le verrou à la fin de la transaction, même en cas d’échec', async () => {
      await expect(
        transaction(async (tx) => {
          await verrouBloc(tx, 'user-9', 'bloc-9')
          throw new Error('raté')
        }),
      ).rejects.toThrow('raté')

      const suite = await transaction(async (tx) => {
        await verrouBloc(tx, 'user-9', 'bloc-9')
        return 'ok'
      })
      expect(suite).toBe('ok')
    })
  })
})
