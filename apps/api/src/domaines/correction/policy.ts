import { Certitude, Niveau, Source } from '@janus/contrats'
import type { Manifeste } from '@janus/contrats'
import { z } from 'zod'

/** Ce que le correcteur doit rendre : ces champs exactement, rien d'autre. */
const Sortie = z.strictObject({
  message: z.string(),
  niveau: Niveau,
  erreurs_critiques: z.array(z.string()),
  source: Source,
  ref: z.string(),
  certitude: Certitude,
})

export const MESSAGE_MIN = 150
export const MESSAGE_MAX = 1500

/** Les espaces insécables et fines que le correcteur glisse parfois, remplacées par une espace normale. */
const ESPACES_SPECIALES = /[   -   　]/gu
/** Le correcteur ne donne jamais de statut : « acquis » et « validé » en sont les mots. */
const MOT_DE_STATUT = /(?<![\p{L}])(acquis|validé)(?![\p{L}])/iu

export interface SortieValide {
  readonly message: string
  readonly niveau: Niveau
  /** Seulement des erreurs critiques de ce bloc, sans doublon. */
  readonly erreurs: readonly string[]
  readonly source: Source
  readonly ref: string
  readonly certitude: Certitude
}

export type Validation =
  | { readonly valide: true; readonly sortie: SortieValide }
  | { readonly valide: false; readonly motif: string }

function lireJson(texte: string): unknown {
  try {
    return JSON.parse(texte)
  } catch {
    return undefined
  }
}

/**
 * Valide ce que le correcteur a rendu : un JSON aux champs exacts, des valeurs prévues, une `ref` qui
 * existe, un message de 150 à 1500 caractères sans mot de statut. Les erreurs critiques inconnues
 * du manifeste sont écartées, pas refusées.
 */
export function validerSortie(texte: string, manifeste: Manifeste): Validation {
  const brut = Sortie.safeParse(lireJson(texte))
  if (!brut.success) return { valide: false, motif: 'JSON absent ou aux champs inattendus' }
  const sortie = brut.data
  const message = sortie.message.replace(ESPACES_SPECIALES, ' ').trim()
  if (message.length < MESSAGE_MIN || message.length > MESSAGE_MAX) {
    return { valide: false, motif: 'message hors de 150 à 1500 caractères' }
  }
  if (MOT_DE_STATUT.test(message)) return { valide: false, motif: 'message avec un mot de statut' }
  if (sortie.ref !== '' && !manifeste.sources.some(({ id }) => id === sortie.ref)) {
    return { valide: false, motif: 'ref inconnue' }
  }
  if (sortie.source === 'support' && sortie.ref === '') {
    return { valide: false, motif: 'source « support » sans ref' }
  }
  const connues = new Set(manifeste.erreurs_critiques.map(({ id }) => id))
  return {
    valide: true,
    sortie: {
      message,
      niveau: sortie.niveau,
      erreurs: [...new Set(sortie.erreurs_critiques.filter((id) => connues.has(id)))],
      source: sortie.source,
      ref: sortie.ref,
      certitude: sortie.certitude,
    },
  }
}

/** Une correction de premier tour sur `echantillonControle` est mise à l'avis d'Amine (`hasard` ∈ [0, 1[). */
export function tireeAuSort(tour: number, echantillonControle: number, hasard: number): boolean {
  return tour === 1 && echantillonControle > 0 && hasard * echantillonControle < 1
}

/** `AAAA-MM` de l'instant : le mois du budget. */
export function moisDe(instant: string): string {
  return instant.slice(0, 7)
}
