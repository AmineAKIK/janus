const LONGUEUR_SUITE = 8

/** Minuscules, NFKC, ponctuation remplacée par un espace, espaces réduits, puis découpe en mots. */
function motsDe(texte: string): string[] {
  return texte
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/u)
    .filter((mot) => mot !== '')
}

/** Toutes les suites de 8 mots consécutifs, chacune jointe par un espace. */
function suitesDe(mots: readonly string[]): string[] {
  return Array.from({ length: Math.max(0, mots.length - LONGUEUR_SUITE + 1) }, (_, debut) =>
    mots.slice(debut, debut + LONGUEUR_SUITE).join(' '),
  )
}

/**
 * Une réponse est recopiée quand la part de ses suites de 8 mots présentes telles quelles
 * dans les sources dépasse strictement `seuil`. Moins de 8 mots : jamais recopiée.
 */
export function estRecopiee(
  reponse: string,
  textesSources: readonly string[],
  seuil: number,
): boolean {
  const suites = suitesDe(motsDe(reponse))
  if (suites.length === 0) return false
  const connues = new Set(textesSources.flatMap((texte) => suitesDe(motsDe(texte))))
  const presentes = suites.filter((suite) => connues.has(suite)).length
  return presentes / suites.length > seuil
}
