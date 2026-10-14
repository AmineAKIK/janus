import type { z } from 'zod'

// Les erreurs de structure des fichiers que l'on écrit à la main (manifeste, tableau d'alignement),
// dites en français avec le chemin du champ en cause. Interne au paquet : pas exporté par l'index.

/** Le chemin d'un champ, par exemple `differees[3].forme`. Vide pour l'objet entier. */
export function cheminDe(segments: readonly PropertyKey[]): string {
  return segments.reduce<string>((chemin, segment) => {
    if (typeof segment === 'number') return `${chemin}[${String(segment)}]`
    const nom = String(segment)
    return chemin === '' ? nom : `${chemin}.${nom}`
  }, '')
}

const TYPES_ATTENDUS: Record<string, string> = {
  string: 'un texte',
  number: 'un nombre',
  int: 'un nombre entier',
  boolean: 'vrai ou faux',
  array: 'une liste',
  object: 'un objet',
}

/** Messages français pour les erreurs de structure produites par Zod. */
export function messageDeStructure(probleme: z.core.$ZodRawIssue): string {
  switch (probleme.code) {
    case 'invalid_type': {
      const attendu = TYPES_ATTENDUS[probleme.expected] ?? probleme.expected
      return probleme.input === undefined
        ? 'Ce champ est obligatoire.'
        : `Ce champ doit être ${attendu}.`
    }
    case 'invalid_value':
      return `Valeur non autorisée. Valeurs possibles : ${probleme.values.map(String).join(', ')}.`
    case 'unrecognized_keys':
      return `Champ inconnu : ${probleme.keys.join(', ')}.`
    case 'too_small':
      return probleme.origin === 'string'
        ? 'Ce texte ne doit pas être vide.'
        : `Cette valeur doit être au moins ${String(probleme.minimum)}.`
    case 'invalid_format':
      return 'Le format de ce champ n’est pas valide.'
    default:
      return 'Cette valeur n’est pas valide.'
  }
}
