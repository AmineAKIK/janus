import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcrypt'

/** Le coût de bcrypt (décision de l'architecture). */
export const COUT_BCRYPT = 12

/** bcrypt, derrière une interface : le hachage factice sert à répondre aussi lentement à un nom inconnu. */
export function creerHacheur(cout: number = COUT_BCRYPT) {
  const factice = bcrypt.hash(randomBytes(16).toString('hex'), cout)
  return {
    hacher: (motDePasse: string): Promise<string> => bcrypt.hash(motDePasse, cout),
    comparer: (motDePasse: string, hash: string): Promise<boolean> =>
      bcrypt.compare(motDePasse, hash),
    /** Compare avec un hachage qui ne correspond à rien : même durée qu'un vrai mot de passe faux. */
    comparerFactice: async (motDePasse: string): Promise<false> => {
      await bcrypt.compare(motDePasse, await factice)
      return false
    },
  }
}
export type Hacheur = ReturnType<typeof creerHacheur>

/** Un jeton de 32 octets aléatoires, que seul le navigateur connaît. */
export function nouveauJeton(): string {
  return randomBytes(32).toString('base64url')
}

/** Ce qu'on garde du jeton en base : son SHA-256. */
export function empreinteDuJeton(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex')
}

const SYSTEMES: readonly (readonly [RegExp, string])[] = [
  [/Android/i, 'Android'],
  [/iPhone|iPad|iPod/i, 'iOS'],
  [/Windows/i, 'Windows'],
  [/Macintosh|Mac OS X/i, 'macOS'],
  [/CrOS/i, 'ChromeOS'],
  [/Linux/i, 'Linux'],
]
// L'ordre compte : Edge et Opera se disent aussi Chrome, Chrome se dit aussi Safari.
const NAVIGATEURS: readonly (readonly [RegExp, string])[] = [
  [/Edg(e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
]
export const APPAREIL_INCONNU = 'Appareil inconnu'

/** « Android · Chrome » : le système et le navigateur déduits du `User-Agent`. */
export function appareilDepuis(userAgent: string | undefined): string {
  if (userAgent === undefined) return APPAREIL_INCONNU
  const systeme = SYSTEMES.find(([motif]) => motif.test(userAgent))?.[1]
  const navigateur = NAVIGATEURS.find(([motif]) => motif.test(userAgent))?.[1]
  if (systeme === undefined && navigateur === undefined) return APPAREIL_INCONNU
  return [systeme, navigateur].filter((partie) => partie !== undefined).join(' · ')
}
