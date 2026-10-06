import type { Manque, TypeEtape } from '@janus/contrats'

export type SerieVerrou = 'restitution' | 'consolidation'

/** Les étapes de cours : tout ce qui précède la restitution. */
const ETAPES_DE_COURS: ReadonlySet<TypeEtape> = new Set([
  'carte',
  'pretest',
  'explication',
  'pratique',
  'atelier',
  'aisance',
])

/** Les questions de la série dont la page n'a pas encore envoyé la réponse du premier tour. */
export function questionsRestantes(
  serie: SerieVerrou,
  questions: readonly string[],
  envoyees: readonly string[],
  manque: readonly Manque[],
): readonly string[] {
  const nonEnvoyees = questions.filter((question) => !envoyees.includes(question))
  if (serie === 'consolidation') return nonEnvoyees
  // Le serveur sait ce qui reste de la restitution, même après un rechargement de la page.
  const incomplete = manque.find(({ code }) => code === 'restitution_incomplete')
  if (incomplete === undefined) return []
  const cotesServeur = incomplete.questions ?? questions
  return cotesServeur.filter((question) => !envoyees.includes(question))
}

/**
 * Les étapes de cours qu'on ne peut pas rouvrir sans le savoir : l'étape courante est une série et
 * toutes ses questions ne sont pas encore envoyées.
 */
export function etapesVerrouillees(
  etapes: readonly { readonly id: string; readonly type: TypeEtape }[],
  courante: string | null,
  restantes: Readonly<Record<SerieVerrou, number>>,
): ReadonlySet<string> {
  const type = etapes.find(({ id }) => id === courante)?.type
  if (type !== 'restitution' && type !== 'consolidation') return new Set()
  if (restantes[type] === 0) return new Set()
  return new Set(etapes.filter((etape) => ETAPES_DE_COURS.has(etape.type)).map(({ id }) => id))
}
