import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { ouvrirBase, promesse, supprimerBase, terminee } from './indexedDb.ts'

const creerMagasin = (base: IDBDatabase) => {
  base.createObjectStore('magasin')
}

describe('indexedDb', () => {
  it('ouvre une base, crée son magasin et la rouvre sans le recréer', async () => {
    const fabrique = new IDBFactory()
    const base = await ouvrirBase(fabrique, 'essai', creerMagasin)
    expect(base?.objectStoreNames.contains('magasin')).toBe(true)
    base?.close()

    let creations = 0
    const rouverte = await ouvrirBase(fabrique, 'essai', () => {
      creations += 1
    })
    expect(rouverte).not.toBeNull()
    expect(creations).toBe(0)
  })

  it('rend null sans IndexedDB', async () => {
    expect(await ouvrirBase(undefined, 'essai', creerMagasin)).toBeNull()
  })

  it('rend null quand l’ouverture est refusée', async () => {
    const refus = Object.assign(new IDBFactory(), {
      open: (): never => {
        throw new Error('refusé')
      },
    })

    expect(await ouvrirBase(refus, 'essai', creerMagasin)).toBeNull()
  })

  it('attend une requête et la fin d’une transaction', async () => {
    const base = await ouvrirBase(new IDBFactory(), 'essai', creerMagasin)
    if (base === null) throw new Error('base absente')
    const transaction = base.transaction('magasin', 'readwrite')
    const magasin = transaction.objectStore('magasin')
    await promesse(magasin.put('valeur', 'cle'))
    await terminee(transaction)

    const lecture = base.transaction('magasin', 'readonly').objectStore('magasin')
    expect(await promesse(lecture.get('cle'))).toBe('valeur')
  })

  it('supprime la base, ou ne fait rien sans IndexedDB', async () => {
    const fabrique = new IDBFactory()
    const base = await ouvrirBase(fabrique, 'essai', creerMagasin)
    base?.close()
    await supprimerBase(fabrique, 'essai')
    expect((await fabrique.databases()).map(({ name }) => name)).not.toContain('essai')

    await expect(supprimerBase(undefined, 'essai')).resolves.toBeUndefined()
  })
})
