/** Un message gardé en attendant d'être envoyé. Le corps a la forme que la route attend. */
export interface EntreeEnvoi {
  /** L'identifiant du message : il sert de clé et d'identifiant d'idempotence. */
  readonly id: string
  /** Le nom de la route, par exemple `POST /evenements`. */
  readonly route: string
  readonly params?: Readonly<Record<string, string>>
  readonly corps: unknown
  /** Une seule entrée par clé : la plus récente remplace la précédente (état d'une page). */
  readonly cle?: string
  readonly cree_le: string
  /** L'ordre de création, pour envoyer dans l'ordre. */
  readonly ordre: number
  readonly essais: number
}

export interface StockageEnvoi {
  /** Garde l'entrée ; si elle a une clé, retire d'abord l'entrée qui avait la même. */
  readonly ajouter: (entree: EntreeEnvoi) => Promise<void>
  /** Toutes les entrées, de la plus ancienne à la plus récente. */
  readonly lister: () => Promise<readonly EntreeEnvoi[]>
  readonly supprimer: (id: string) => Promise<void>
  readonly compterEssai: (id: string) => Promise<void>
}

/** Le stockage en mémoire : les tests, et le repli quand IndexedDB manque. */
export function creerStockageMemoire(): StockageEnvoi {
  const entrees = new Map<string, EntreeEnvoi>()
  return {
    ajouter: (entree) => {
      if (entree.cle !== undefined) {
        for (const [id, autre] of entrees) if (autre.cle === entree.cle) entrees.delete(id)
      }
      entrees.set(entree.id, entree)
      return Promise.resolve()
    },
    lister: () => Promise.resolve([...entrees.values()].sort((a, b) => a.ordre - b.ordre)),
    supprimer: (id) => {
      entrees.delete(id)
      return Promise.resolve()
    },
    compterEssai: (id) => {
      const entree = entrees.get(id)
      if (entree !== undefined) entrees.set(id, { ...entree, essais: entree.essais + 1 })
      return Promise.resolve()
    },
  }
}

const BASE = 'janus'
const MAGASIN = 'boite_envoi'

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

function terminee(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve()
    }
    transaction.onerror = () => {
      reject(transaction.error ?? new Error('IndexedDB a échoué'))
    }
    transaction.onabort = () => {
      reject(transaction.error ?? new Error('IndexedDB a annulé la transaction'))
    }
  })
}

/**
 * La boîte d'envoi dans IndexedDB : base `janus`, magasin `boite_envoi`, clé = `id`. Rend `null`
 * si IndexedDB n'est pas disponible (navigation privée de certains navigateurs, par exemple).
 */
export async function ouvrirStockageIndexedDB(
  fabrique: IDBFactory | undefined = globalThis.indexedDB,
): Promise<StockageEnvoi | null> {
  // `indexedDB` peut manquer, ou refuser de s'ouvrir.
  if (typeof fabrique === 'undefined') return null
  let base: IDBDatabase
  try {
    const ouverture = fabrique.open(BASE, 1)
    ouverture.onupgradeneeded = () => {
      ouverture.result.createObjectStore(MAGASIN, { keyPath: 'id' })
    }
    base = await promesse(ouverture)
  } catch {
    return null
  }

  const magasin = (mode: IDBTransactionMode) => {
    const transaction = base.transaction(MAGASIN, mode)
    return { transaction, magasin: transaction.objectStore(MAGASIN) }
  }
  const lire = async (): Promise<EntreeEnvoi[]> => {
    const { magasin: m } = magasin('readonly')
    const toutes: unknown = await promesse(m.getAll())
    return Array.isArray(toutes) ? toutes.filter(estEntree) : []
  }

  return {
    ajouter: async (entree) => {
      const anciennes =
        entree.cle === undefined ? [] : (await lire()).filter((autre) => autre.cle === entree.cle)
      const { transaction, magasin: m } = magasin('readwrite')
      for (const ancienne of anciennes) m.delete(ancienne.id)
      m.put(entree)
      await terminee(transaction)
    },
    lister: async () => (await lire()).sort((a, b) => a.ordre - b.ordre),
    supprimer: async (id) => {
      const { transaction, magasin: m } = magasin('readwrite')
      m.delete(id)
      await terminee(transaction)
    },
    compterEssai: async (id) => {
      const { transaction, magasin: m } = magasin('readwrite')
      const entree: unknown = await promesse(m.get(id))
      if (estEntree(entree)) m.put({ ...entree, essais: entree.essais + 1 })
      await terminee(transaction)
    },
  }
}

function estEntree(valeur: unknown): valeur is EntreeEnvoi {
  return (
    typeof valeur === 'object' &&
    valeur !== null &&
    'id' in valeur &&
    typeof valeur.id === 'string' &&
    'route' in valeur &&
    typeof valeur.route === 'string' &&
    'ordre' in valeur &&
    typeof valeur.ordre === 'number' &&
    'essais' in valeur &&
    typeof valeur.essais === 'number'
  )
}

/**
 * Un stockage qui attend l'ouverture d'IndexedDB : en attendant, et si IndexedDB manque, il garde
 * en mémoire (les messages partent alors directement, sans survivre à un rechargement).
 */
export function creerStockageParesseux(ouverture: Promise<StockageEnvoi | null>): {
  readonly stockage: StockageEnvoi
  /** Vrai une fois qu'on sait qu'IndexedDB n'est pas disponible. */
  readonly indisponible: () => boolean
} {
  const repli = creerStockageMemoire()
  let reel: StockageEnvoi | null = null
  let indisponible = false
  const pret = ouverture.then((ouvert) => {
    if (ouvert === null) indisponible = true
    reel = ouvert
  })
  const choisir = async () => {
    await pret
    return reel ?? repli
  }
  return {
    indisponible: () => indisponible,
    stockage: {
      ajouter: async (entree) => (await choisir()).ajouter(entree),
      lister: async () => (await choisir()).lister(),
      supprimer: async (id) => (await choisir()).supprimer(id),
      compterEssai: async (id) => (await choisir()).compterEssai(id),
    },
  }
}
