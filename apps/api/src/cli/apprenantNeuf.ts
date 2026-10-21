import type { Manifeste } from '@janus/contrats'
import type { JeuDeTest } from './evaluerIa.ts'

// Garde-fou tiré du B01 (classe 5 des leçons) : les réponses que l'agent neuf donne à l'épreuve 1
// (`prompts/fiches/apprenant-neuf.md`) passent au correcteur, et chacune doit sortir Solide. Une bonne
// réponse qui ne sort pas Solide dit que l'attendu de la question est mal écrit (une grille, un modèle
// à recopier), pas que l'apprenant s'est trompé.

/**
 * Une ligne de l'épreuve : `ID : déductible (étape, écran) : réponse`, `ID : RECOPIÉE (…) : réponse`,
 * `ID : NON DÉDUCTIBLE : ce qui manque`, `ID : HORS CHAMP ASSUMÉ : réponse`. L'agent la met parfois
 * en liste (`- `) ou l'id en code (`` ` ``) : on tolère les deux.
 */
const LIGNE =
  /^\s*(?:[-*]\s+)?`?([A-Za-z][\w-]*)`?\s*:\s*(déductible|non déductible|recopiée|hors champ assumé)\b\s*(?:\([^)]*\))?\s*:\s*(.+?)\s*$/iu

export interface LectureApprenantNeuf {
  /** Un jeu par série où l'agent a répondu ; vide si aucune ligne n'est une question du manifeste. */
  readonly jeux: readonly JeuDeTest[]
  /** Les questions du manifeste sans ligne déductible ou recopiée : non déductibles, hors champ, ou absentes. */
  readonly sansReponse: readonly string[]
  /** Les ids lus qui ne sont pas une question de restitution ni de rappel (exercices, inventions). */
  readonly ignores: readonly string[]
}

/** Lit les lignes de l'agent neuf et en fait les jeux de test du correcteur, niveau attendu Solide. */
export function lireLApprenantNeuf(texte: string, manifeste: Manifeste): LectureApprenantNeuf {
  const series = ['restitution', 'rappel'] as const
  const reponses = new Map<string, string>()
  const ignores: string[] = []
  for (const ligne of texte.split('\n')) {
    const lue = LIGNE.exec(ligne)
    if (lue === null) continue
    const [, id = '', verdict = '', reponse = ''] = lue
    const serie = series.find((nom) => manifeste[nom].some((question) => question.id === id))
    if (serie === undefined) {
      ignores.push(id)
      continue
    }
    const mot = verdict.toLowerCase()
    // Une réponse déductible ou recopiée est une bonne réponse : elle doit sortir Solide. Les autres
    // lignes disent un défaut de la fiche, pas une réponse à corriger.
    if (mot !== 'déductible' && mot !== 'recopiée') continue
    if (!reponses.has(id)) reponses.set(id, reponse)
  }
  const jeux = series.flatMap((serie) => {
    const cas = manifeste[serie]
      .filter((question) => reponses.has(question.id))
      .map((question) => ({
        id: question.id,
        question: question.id,
        reponse: reponses.get(question.id) ?? '',
        confiance: 'sur' as const,
        niveauAmine: 'solide' as const,
        genre: 'normal' as const,
      }))
    return cas.length === 0 ? [] : [{ manifeste: '', serie, cas }]
  })
  const sansReponse = series.flatMap((serie) =>
    manifeste[serie].filter((question) => !reponses.has(question.id)).map(({ id }) => id),
  )
  return { jeux, sansReponse, ignores: [...new Set(ignores)] }
}
