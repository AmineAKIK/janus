import { z } from 'zod'

const FORMAT_UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/** Identifiant UUID version 7 (variante RFC 9562), en minuscules. */
export const IdUuidV7 = z
  .string({ error: 'L’identifiant doit être un texte.' })
  .regex(FORMAT_UUID_V7, { error: 'L’identifiant doit être un UUID version 7.' })
export type IdUuidV7 = z.infer<typeof IdUuidV7>

const COMPTEUR_MAX = 0xfff

let dernierTemps = -1
let compteur = 0

function enHexadecimal(octets: Uint8Array): string {
  return Array.from(octets, (octet) => octet.toString(16).padStart(2, '0')).join('')
}

/**
 * Génère un UUID v7 : 48 bits de temps, puis un compteur de 12 bits qui garde l'ordre croissant
 * quand plusieurs identifiants naissent dans la même milliseconde, puis 62 bits aléatoires.
 *
 * Ce paquet n'a pas accès à l'horloge : l'instant (en millisecondes depuis 1970) vient de l'appelant.
 * Si l'horloge recule, l'identifiant reprend le dernier instant connu pour ne jamais décroître.
 */
export function nouvelId(maintenantMs: number): IdUuidV7 {
  let temps = Math.max(Math.floor(maintenantMs), dernierTemps)
  if (temps === dernierTemps) {
    compteur += 1
    if (compteur > COMPTEUR_MAX) {
      // Plus de 4 096 identifiants dans la même milliseconde : on avance d'une milliseconde.
      temps += 1
      compteur = 0
    }
  } else {
    compteur = 0
  }
  dernierTemps = temps

  const aleatoire = crypto.getRandomValues(new Uint8Array(8))
  const octets = new Uint8Array(16)
  // 48 bits de temps, sans opérateurs binaires (au-delà de 32 bits ils tronquent).
  let reste = temps
  for (let i = 5; i >= 0; i -= 1) {
    octets[i] = reste % 256
    reste = Math.floor(reste / 256)
  }
  octets[6] = 0x70 | (compteur >> 8)
  octets[7] = compteur & 0xff
  octets[8] = 0x80 | ((aleatoire[0] ?? 0) & 0x3f)
  octets.set(aleatoire.subarray(1), 9)

  const hexa = enHexadecimal(octets)
  return IdUuidV7.parse(
    `${hexa.slice(0, 8)}-${hexa.slice(8, 12)}-${hexa.slice(12, 16)}-${hexa.slice(16, 20)}-${hexa.slice(20)}`,
  )
}
