import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Au-delà de ce poids de médias `data:` dans une fiche, les sons sortent dans des fichiers à côté. */
export const SEUIL_MEDIAS_OCTETS = 2 * 1024 * 1024

/** Les `id` sous lesquels une fiche range son manifeste. */
const IDENTIFIANTS_MANIFESTE = new Set(['bloc-manifest', 'manifeste'])

export function empreinteDuTexte(contenu: string | Uint8Array): string {
  return createHash('sha256').update(contenu).digest('hex')
}

/** Le texte JSON du manifeste d'une fiche : `<script type="application/json" id="bloc-manifest">`. */
export function extraireManifeste(html: string): string | undefined {
  for (const [, attributs, contenu] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const type = /\btype\s*=\s*["']([^"']*)["']/i.exec(attributs ?? '')?.[1]
    const id = /\bid\s*=\s*["']([^"']*)["']/i.exec(attributs ?? '')?.[1]
    if (type === 'application/json' && id !== undefined && IDENTIFIANTS_MANIFESTE.has(id)) {
      return contenu
    }
  }
  return undefined
}

const EXTENSIONS_SON: Readonly<Record<string, string>> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
}

export interface FichierExtrait {
  readonly nom: string
  readonly contenu: Uint8Array
}

export interface ResultatExtraction {
  readonly html: string
  readonly fichiers: readonly FichierExtrait[]
  /** Le poids des médias `data:` avant extraction. */
  readonly octetsMedias: number
}

const MOTIF_DATA = /data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)/gi

/**
 * Si les médias `data:` de la fiche pèsent plus de 2 Mo, extrait les sons dans des fichiers nommés
 * d'après leur contenu et réécrit leurs adresses (relatives : ils sont servis à côté de la fiche).
 */
export function extraireSons(html: string): ResultatExtraction {
  let octetsMedias = 0
  for (const [media] of html.matchAll(MOTIF_DATA)) octetsMedias += media.length
  if (octetsMedias <= SEUIL_MEDIAS_OCTETS) return { html, fichiers: [], octetsMedias }
  const fichiers = new Map<string, FichierExtrait>()
  const reecrit = html.replace(MOTIF_DATA, (media, type: string, base64: string) => {
    const extension = EXTENSIONS_SON[type.toLowerCase()]
    if (extension === undefined) return media
    const contenu = Buffer.from(base64, 'base64')
    const nom = `${empreinteDuTexte(contenu).slice(0, 16)}.${extension}`
    fichiers.set(nom, { nom, contenu })
    return nom
  })
  return { html: reecrit, fichiers: [...fichiers.values()], octetsMedias }
}

/** Où vont les fiches : `<dossier>/<code>/<empreinte>.html`, et les sons à côté. */
export function creerStockage(dossier: string) {
  return {
    ecrire: async (code: string, nom: string, contenu: string | Uint8Array): Promise<string> => {
      const repertoire = join(dossier, code)
      await mkdir(repertoire, { recursive: true })
      await writeFile(join(repertoire, nom), contenu)
      return `${code}/${nom}`
    },
  }
}
export type Stockage = ReturnType<typeof creerStockage>
