import type { ModificationReglages } from '@janus/contrats'

/**
 * Les règles de la méthode : les délais qui fondent la preuve. L'écran les montre en lecture seule,
 * le serveur refuse donc de les écrire tant que le point à trancher ne l'est pas.
 */
export const REGLES_DE_LA_METHODE = [
  'delaiConsolidationMinutes',
  'delaiVerificationJours',
  'delaiRetestJours',
  'entretienMois',
  'delaiNouvelEssaiJours',
  'echecsAvantDescente',
  'seuilConsolidation',
  'blocsEntreRevues',
] as const satisfies readonly (keyof ModificationReglages)[]

/** Les règles de la méthode que cette modification voudrait changer. */
export function reglesTouchees(modification: ModificationReglages): string[] {
  return REGLES_DE_LA_METHODE.filter((cle) => modification[cle] !== undefined)
}

/** Les seuls réglages qui changent : une clé absente ne remet rien à zéro. */
export function reglagesDonnes(modification: ModificationReglages): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(modification).filter(([, valeur]) => valeur !== undefined),
  )
}

/** L'ETag d'une version des réglages. */
export function etagDe(version: number): string {
  return `"${String(version)}"`
}

/** La version que `If-Match` désigne, ou `undefined` si l'en-tête manque ou n'est pas une de nos versions. */
export function versionDeIfMatch(enTete: string | undefined): number | undefined {
  const nu = enTete?.trim().replace(/^W\//u, '').replaceAll('"', '')
  return nu !== undefined && /^[1-9][0-9]{0,8}$/u.test(nu) ? Number(nu) : undefined
}
