import type { Niveau } from './enums.ts'

// Le correcteur de la démo : des règles simples et déterministes, sans IA. La PR-085 le réutilise
// pour le mode « correcteur simulé » du serveur.

/** Début de chaque message du correcteur simulé : on voit tout de suite que ce n'est pas une vraie correction. */
export const PREFIXE_CORRECTION_SIMULEE = 'Correction simulée (démo) : '

/** Délai simulé avant la réponse, pour montrer l'état « correction en cours ». */
export const DELAI_CORRECTION_SIMULEE_MS = 800

const LONGUEUR_MINIMALE = 40
const LONGUEUR_MOT_SIGNIFICATIF = 4

export type CorrectionSimulee =
  | { readonly refusee: true; readonly message: string }
  | {
      readonly refusee: false
      readonly niveau: Niveau
      readonly message: string
      /** Un indice pour repartir, seulement pour `pas_encore`. */
      readonly indice?: string
    }

/** Minuscules, sans accents, ponctuation remplacée par un espace. */
function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
}

function mots(texte: string): string[] {
  return normaliser(texte)
    .split(/\s+/u)
    .filter((mot) => mot !== '')
}

const avecPrefixe = (texte: string) => `${PREFIXE_CORRECTION_SIMULEE}${texte}`

/**
 * Corrige `reponse` en la comparant à `attendu`, dans cet ordre :
 * 1. réponse vide : refusée ;
 * 2. « je ne sais pas » (sans tenir compte de la casse, des accents ni de la ponctuation) : `pas_encore`, avec un indice ;
 * 3. moins de 40 caractères : `fragile` ;
 * 4. au moins la moitié des mots de plus de 4 lettres de l'attendu sont présents : `solide` ;
 * 5. sinon : `partiel`.
 */
export function corrigerSimule(reponse: string, attendu: string): CorrectionSimulee {
  const texte = reponse.trim()
  if (texte === '') {
    return { refusee: true, message: avecPrefixe('écris une réponse avant de l’envoyer.') }
  }

  const significatifs = [
    ...new Set(mots(attendu).filter((mot) => mot.length > LONGUEUR_MOT_SIGNIFICATIF)),
  ]
  if (mots(texte).join(' ') === 'je ne sais pas') {
    const pistes = significatifs.slice(0, 2).map((mot) => `« ${mot} »`)
    const indice = `Indice : pense à ${pistes.length > 0 ? pistes.join(' et ') : 'relire le cours'}.`
    return {
      refusee: false,
      niveau: 'pas_encore',
      message: avecPrefixe('pas de souci, on repart du cours.'),
      indice,
    }
  }
  if (texte.length < LONGUEUR_MINIMALE) {
    return {
      refusee: false,
      niveau: 'fragile',
      message: avecPrefixe('ta réponse est trop courte pour montrer que tu as compris.'),
    }
  }

  const presents = new Set(mots(texte))
  const trouves = significatifs.filter((mot) => presents.has(mot)).length
  if (trouves * 2 >= significatifs.length) {
    return {
      refusee: false,
      niveau: 'solide',
      message: avecPrefixe('bonne réponse, les idées importantes y sont.'),
    }
  }
  return {
    refusee: false,
    niveau: 'partiel',
    message: avecPrefixe('il manque encore des idées importantes.'),
  }
}
