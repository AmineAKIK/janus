// L'évaluation IA de l'épreuve 1 (`pnpm ia:evaluer --fiche`) tourne par le workflow `ia-evaluer.yml`, qui porte
// les clés du correcteur dans les secrets du dépôt (leçons du B06 : aucune clé dans l'environnement d'une
// session, et aucune à demander à Amine). Ce module choisit l'exécution déclenchée et lit ses annotations.

export interface Execution {
  readonly id: number
  readonly status: string
  readonly conclusion: string | null
  readonly created_at: string
  readonly html_url: string
}

/** L'exécution lancée par notre envoi : la plus ancienne créée après lui, sur la branche demandée. */
export function choisirLExecution(
  executions: readonly Execution[],
  depuis: Date,
): Execution | undefined {
  const marge = 5_000
  return [...executions]
    .filter((e) => Date.parse(e.created_at) >= depuis.getTime() - marge)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))[0]
}

/** `propriétaire/dépôt` d'après l'adresse du dépôt distant (https ou ssh), sans passer par GraphQL. */
export function depotDepuisLAdresse(adresse: string): string | undefined {
  const lue = /github\.com[/:]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/u.exec(adresse.trim())
  return lue === null ? undefined : `${lue[1] ?? ''}/${lue[2] ?? ''}`
}

export interface Annotation {
  readonly title?: string | null
  readonly message: string
}

/** Les annotations du job qui portent l'évaluation (titre « Évaluation » ou « Messages des cas … »). */
export function texteDesAnnotations(annotations: readonly Annotation[]): string {
  return annotations
    .filter(
      (a) =>
        (a.title ?? '').startsWith('Évaluation') || (a.title ?? '').startsWith('Messages des cas'),
    )
    .map((a) => `${a.title ?? ''}\n${a.message}`)
    .join('\n\n')
}
