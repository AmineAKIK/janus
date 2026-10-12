const BASE = 'janus-donnees'
const MAGASIN = 'instantane'
const CLE = 'courant'

/** Où l'appli garde ses dernières données lues : un seul enregistrement, remplacé à chaque fois. */
export interface StockageDonnees {
  readonly lire: () => Promise<unknown>
  readonly ecrire: (valeur: unknown) => Promise<void>
  readonly effacer: () => Promise<void>
}

export function creerStockageDonneesMemoire(): StockageDonnees {
  let valeur: unknown
  return {
    lire: () => Promise.resolve(valeur),
    ecrire: (nouvelle) => {
      valeur = nouvelle
      return Promise.resolve()
    },
    effacer: () => {
      valeur = undefined
      return Promise.resolve()
    },
  }
}

function promesse<T>(requete: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    requete.onsuccess = () => {
      resolve(requete.result)
    }
    requete.onerror = () => {
      reject(requete.error ?? new Error('IndexedDB a échoué'))
    }
  })
}

/** Supprime toute la base : à la suppression du compte. */
export function supprimerStockageDonnees(
  fabrique: IDBFactory | undefined = globalThis.indexedDB,
): Promise<void> {
  if (typeof fabrique === 'undefined') return Promise.resolve()
  return new Promise((resolve) => {
    const demande = fabrique.deleteDatabase(BASE)
    demande.onsuccess = () => {
      resolve()
    }
    demande.onerror = () => {
      resolve()
    }
    demande.onblocked = () => {
      resolve()
    }
  })
}

/** Le stockage dans IndexedDB ; `null` quand IndexedDB manque ou refuse de s'ouvrir. */
export async function ouvrirStockageDonnees(
  fabrique: IDBFactory | undefined = globalThis.indexedDB,
): Promise<StockageDonnees | null> {
  if (typeof fabrique === 'undefined') return null
  let base: IDBDatabase
  try {
    const ouverture = fabrique.open(BASE, 1)
    ouverture.onupgradeneeded = () => {
      ouverture.result.createObjectStore(MAGASIN)
    }
    base = await promesse(ouverture)
  } catch {
    return null
  }
  const magasin = (mode: IDBTransactionMode) => base.transaction(MAGASIN, mode).objectStore(MAGASIN)
  return {
    lire: () => promesse<unknown>(magasin('readonly').get(CLE)),
    ecrire: async (valeur) => {
      await promesse(magasin('readwrite').put(valeur, CLE))
    },
    effacer: async () => {
      await promesse(magasin('readwrite').delete(CLE))
    },
  }
}
