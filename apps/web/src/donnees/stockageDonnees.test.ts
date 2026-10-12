import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import {
  creerStockageDonneesMemoire,
  ouvrirStockageDonnees,
  supprimerStockageDonnees,
} from './stockageDonnees.ts'

describe.each([
  ['mémoire', () => Promise.resolve(creerStockageDonneesMemoire())],
  [
    'IndexedDB',
    async () => {
      const stockage = await ouvrirStockageDonnees(new IDBFactory())
      if (stockage === null) throw new Error('IndexedDB indisponible dans le test')
      return stockage
    },
  ],
])('stockage des données lues : %s', (_nom, creer) => {
  it('écrit, relit, remplace et efface', async () => {
    const stockage = await creer()
    expect(await stockage.lire()).toBeUndefined()

    await stockage.ecrire({ a: 1 })
    expect(await stockage.lire()).toEqual({ a: 1 })

    await stockage.ecrire({ a: 2 })
    expect(await stockage.lire()).toEqual({ a: 2 })

    await stockage.effacer()
    expect(await stockage.lire()).toBeUndefined()
  })
})

describe('IndexedDB', () => {
  it('survit à une réouverture', async () => {
    const fabrique = new IDBFactory()
    await (await ouvrirStockageDonnees(fabrique))?.ecrire({ garde: true })

    expect(await (await ouvrirStockageDonnees(fabrique))?.lire()).toEqual({ garde: true })
  })

  it('se supprime avec le compte, sans attendre une connexion ouverte, et sans IndexedDB ne fait rien', async () => {
    const fabrique = new IDBFactory()
    await (await ouvrirStockageDonnees(fabrique))?.ecrire({ garde: true })

    await expect(supprimerStockageDonnees(fabrique)).resolves.toBeUndefined()
    await expect(supprimerStockageDonnees(undefined)).resolves.toBeUndefined()
  })

  it('rend null quand IndexedDB manque ou refuse de s’ouvrir', async () => {
    const refuse = {
      open: () => {
        throw new Error('refusé')
      },
    } as unknown as IDBFactory

    expect(await ouvrirStockageDonnees(refuse)).toBeNull()
    expect(await ouvrirStockageDonnees(undefined)).toBeNull()
  })
})
