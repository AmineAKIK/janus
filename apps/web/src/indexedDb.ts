/** Ce que partagent les deux bases IndexedDB de l'appli : les données lues et la boîte d'envoi. */

/** Attend le résultat d'une requête IndexedDB. */
export function promesse<T>(requete: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    requete.onsuccess = () => {
      resolve(requete.result)
    }
    requete.onerror = () => {
      reject(requete.error ?? new Error('IndexedDB a échoué'))
    }
  })
}

/** Attend la fin d'une transaction : ses écritures sont alors enregistrées. */
export function terminee(transaction: IDBTransaction): Promise<void> {
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
 * Ouvre la base `nom` (version 1) et crée son magasin à la première ouverture ; `null` quand
 * IndexedDB manque ou refuse de s'ouvrir (navigation privée de certains navigateurs).
 */
export async function ouvrirBase(
  fabrique: IDBFactory | undefined,
  nom: string,
  creerMagasin: (base: IDBDatabase) => void,
): Promise<IDBDatabase | null> {
  if (typeof fabrique === 'undefined') return null
  try {
    const ouverture = fabrique.open(nom, 1)
    ouverture.onupgradeneeded = () => {
      creerMagasin(ouverture.result)
    }
    return await promesse(ouverture)
  } catch {
    return null
  }
}

/**
 * Supprime toute la base `nom`. Une connexion encore ouverte retarde la suppression, sans la
 * bloquer : la promesse se résout dans tous les cas.
 */
export function supprimerBase(fabrique: IDBFactory | undefined, nom: string): Promise<void> {
  if (typeof fabrique === 'undefined') return Promise.resolve()
  return new Promise((resolve) => {
    const demande = fabrique.deleteDatabase(nom)
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
