import { createHash } from 'node:crypto'

/** Le SHA-256 d'un contenu, en hexadécimal : l'empreinte que l'appli garde partout. */
export function sha256Hex(contenu: string | Uint8Array): string {
  return createHash('sha256').update(contenu).digest('hex')
}

/** L'empreinte d'une valeur JSON, dans l'ordre où ses champs ont été écrits. */
export function empreinteJson(contenu: unknown): string {
  return sha256Hex(JSON.stringify(contenu))
}
