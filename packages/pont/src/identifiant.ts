const TEMPS_MAX = 2 ** 48 - 1

let dernierTemps = -1
let compteur = 0

function octetsAleatoires(taille: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(taille))
}

const hex = (octets: Uint8Array) =>
  Array.from(octets, (octet) => octet.toString(16).padStart(2, '0')).join('')

/**
 * Un UUID v7 : 48 bits de temps, un compteur de 12 bits qui garde l'ordre dans la même milliseconde,
 * puis des bits aléatoires. Même format que `nouvelId` de `packages/contrats`, sans zod.
 */
export function nouvelId(maintenant: number): string {
  let temps = Math.min(Math.max(Math.floor(maintenant), dernierTemps), TEMPS_MAX)
  let suite = temps === dernierTemps ? compteur + 1 : 0
  if (suite > 0xfff) {
    temps += 1
    suite = 0
  }
  dernierTemps = temps
  compteur = suite
  const aleatoire = octetsAleatoires(8)
  // Variante RFC 9562 : les deux premiers bits à 10.
  aleatoire[0] = ((aleatoire[0] ?? 0) & 0x3f) | 0x80
  const tempsHex = temps.toString(16).padStart(12, '0')
  const suiteHex = suite.toString(16).padStart(3, '0')
  const fin = hex(aleatoire)
  return `${tempsHex.slice(0, 8)}-${tempsHex.slice(8)}-7${suiteHex}-${fin.slice(0, 4)}-${fin.slice(4)}`
}
