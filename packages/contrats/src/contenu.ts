/** Une valeur JSON dont les champs sont rangés par nom : la même valeur donne le même texte. */
export function canonique(valeur: unknown): unknown {
  if (Array.isArray(valeur)) return valeur.map(canonique)
  if (typeof valeur === 'object' && valeur !== null) {
    return Object.fromEntries(
      Object.entries(valeur)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([cle, contenu]) => [cle, canonique(contenu)]),
    )
  }
  return valeur
}

/** Vrai si deux valeurs JSON ont le même contenu, quel que soit l'ordre des champs. */
export function memeContenu(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonique(a)) === JSON.stringify(canonique(b))
}
