import { Certitude, Niveau, Source } from '@janus/contrats'
import type { Confiance, Manifeste } from '@janus/contrats'
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

/**
 * Règle de la consigne (règle 10, décision du 14 octobre 2026) : une erreur critique du bloc dans la
 * réponse plafonne le niveau à fragile, et à pas_encore si l'apprenant s'est dit sûr. Le correcteur
 * ne la suit pas à chaque fois : le code l'applique sur ce qu'il a rendu, sans jamais relever un niveau.
 */
const PLAFOND_AVEC_ERREUR: Readonly<Record<Confiance, Niveau>> = {
  sur: 'pas_encore',
  hesitant: 'fragile',
  hasard: 'fragile',
}
const RANGS: Readonly<Record<Niveau, number>> = { pas_encore: 0, fragile: 1, partiel: 2, solide: 3 }
const plusBas = (a: Niveau, b: Niveau): Niveau => (RANGS[a] <= RANGS[b] ? a : b)

export interface SortieValide {
  readonly message: string
  /** Le niveau retenu : celui du correcteur, plafonné s'il signale une erreur critique du bloc. */
  readonly niveau: Niveau
  /** Le niveau tel que le correcteur l'a rendu, avant la règle. */
  readonly niveauRendu: Niveau
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
 * du manifeste sont écartées, pas refusées. Une erreur critique retenue plafonne le niveau selon la
 * confiance de l'apprenant (`PLAFOND_AVEC_ERREUR`).
 */
export function validerSortie(
  texte: string,
  manifeste: Manifeste,
  confiance: Confiance,
): Validation {
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
  const erreurs = [...new Set(sortie.erreurs_critiques.filter((id) => connues.has(id)))]
  return {
    valide: true,
    sortie: {
      message,
      niveau:
        erreurs.length === 0
          ? sortie.niveau
          : plusBas(sortie.niveau, PLAFOND_AVEC_ERREUR[confiance]),
      niveauRendu: sortie.niveau,
      erreurs,
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
