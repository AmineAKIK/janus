import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import type { EntreeEnvoi } from './stockageEnvoi.ts'
import {
  creerStockageMemoire,
  creerStockageParesseux,
  ouvrirStockageIndexedDB,
  supprimerStockageIndexedDB,
} from './stockageEnvoi.ts'

const entree = (id: string, ordre: number, extra: Partial<EntreeEnvoi> = {}): EntreeEnvoi => ({
  id,
  route: 'POST /evenements',
  corps: { id },
  cree_le: '2026-10-12T10:00:00.000Z',
  ordre,
  essais: 0,
  ...extra,
})

/** Le même contrat pour les deux stockages : la mémoire (tests, repli) et IndexedDB (production). */
describe.each([
  ['mémoire', () => Promise.resolve(creerStockageMemoire())],
  [
    'IndexedDB',
    async () => {
      const stockage = await ouvrirStockageIndexedDB(new IDBFactory())
      if (stockage === null) throw new Error('IndexedDB indisponible dans le test')
      return stockage
    },
  ],
])('stockage de la boîte d’envoi : %s', (_nom, creer) => {
  it('rend les entrées de la plus ancienne à la plus récente', async () => {
    const stockage = await creer()
    await stockage.ajouter(entree('b', 2))
    await stockage.ajouter(entree('a', 1))

    expect((await stockage.lister()).map(({ id }) => id)).toEqual(['a', 'b'])
  })

  it('une entrée avec la même clé remplace la précédente', async () => {
    const stockage = await creer()
    await stockage.ajouter(entree('a', 1, { cle: 'page:B03' }))
    await stockage.ajouter(entree('b', 2))
    await stockage.ajouter(entree('c', 3, { cle: 'page:B03' }))

    expect((await stockage.lister()).map(({ id }) => id)).toEqual(['b', 'c'])
  })

  it('supprime une entrée et compte les essais', async () => {
    const stockage = await creer()
    await stockage.ajouter(entree('a', 1))
    await stockage.ajouter(entree('b', 2))

    await stockage.compterEssai('a')
    await stockage.compterEssai('a')
    await stockage.compterEssai('inconnue')
    await stockage.supprimer('b')

    expect(await stockage.lister()).toEqual([entree('a', 1, { essais: 2 })])
  })
})

describe('IndexedDB', () => {
  it('garde les entrées après la fermeture et la réouverture', async () => {
    const fabrique = new IDBFactory()
    const premier = await ouvrirStockageIndexedDB(fabrique)
    await premier?.ajouter(entree('a', 1))

    const second = await ouvrirStockageIndexedDB(fabrique)

    expect(await second?.lister()).toEqual([entree('a', 1)])
  })

  it('ignore une ligne abîmée', async () => {
    const fabrique = new IDBFactory()
    const ouverture = fabrique.open('janus', 1)
    ouverture.onupgradeneeded = () => {
      ouverture.result.createObjectStore('boite_envoi', { keyPath: 'id' })
    }
    const base = await new Promise<IDBDatabase>((resolve) => {
      ouverture.onsuccess = () => {
        resolve(ouverture.result)
      }
    })
    const transaction = base.transaction('boite_envoi', 'readwrite')
    transaction.objectStore('boite_envoi').put({ id: 'abimee' })
    await new Promise((resolve) => {
      transaction.oncomplete = resolve
    })
    base.close()

    const stockage = await ouvrirStockageIndexedDB(fabrique)
    await stockage?.ajouter(entree('a', 1))

    expect((await stockage?.lister())?.map(({ id }) => id)).toEqual(['a'])
  })

  it('rend null quand IndexedDB manque ou refuse de s’ouvrir', async () => {
    const refuse = {
      open: () => {
        throw new Error('refusé')
      },
    } as unknown as IDBFactory

    expect(await ouvrirStockageIndexedDB(refuse)).toBeNull()
    expect(await ouvrirStockageIndexedDB(undefined)).toBeNull()
  })

  it('supprime la base sans attendre une connexion encore ouverte, et ne fait rien sans IndexedDB', async () => {
    const fabrique = new IDBFactory()
    const stockage = await ouvrirStockageIndexedDB(fabrique)
    await stockage?.ajouter(entree('a', 1))

    await expect(supprimerStockageIndexedDB(fabrique)).resolves.toBeUndefined()
    await expect(supprimerStockageIndexedDB(undefined)).resolves.toBeUndefined()

    const jamaisOuverte = new IDBFactory()
    await expect(supprimerStockageIndexedDB(jamaisOuverte)).resolves.toBeUndefined()
    expect((await jamaisOuverte.databases()).map(({ name }) => name)).not.toContain('janus')
  })
})

describe('stockage paresseux', () => {
  it('garde en mémoire tant qu’IndexedDB s’ouvre, puis passe dessus', async () => {
    const reel = await ouvrirStockageIndexedDB(new IDBFactory())
    const { stockage, indisponible } = creerStockageParesseux(Promise.resolve(reel))

    await stockage.ajouter(entree('a', 1))
    await stockage.compterEssai('a')

    expect(indisponible()).toBe(false)
    expect(await reel?.lister()).toEqual([entree('a', 1, { essais: 1 })])
    await stockage.supprimer('a')
    expect(await stockage.lister()).toEqual([])
  })

  it('sans IndexedDB, repli en mémoire et indisponible() le dit', async () => {
    const { stockage, indisponible } = creerStockageParesseux(Promise.resolve(null))

    await stockage.ajouter(entree('a', 1))

    expect(await stockage.lister()).toEqual([entree('a', 1)])
    expect(indisponible()).toBe(true)
  })
})
