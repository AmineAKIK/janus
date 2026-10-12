const CLE = 'janus.blocs-ouverts'

function lire(): readonly string[] {
  try {
    const brut: unknown = JSON.parse(sessionStorage.getItem(CLE) ?? '[]')
    return Array.isArray(brut)
      ? brut.filter((code): code is string => typeof code === 'string')
      : []
  } catch {
    return []
  }
}

/** Ce bloc a déjà été ouvert (et sa raison donnée) pendant cette session de l'onglet. */
export function dejaOuvert(bloc: string): boolean {
  return lire().includes(bloc)
}

export function marquerOuvert(bloc: string): void {
  try {
    sessionStorage.setItem(CLE, JSON.stringify([...new Set([...lire(), bloc])]))
  } catch {
    // Sans stockage de session, la page redemande l'ouverture au prochain affichage.
  }
}
