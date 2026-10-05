import type { z } from 'zod'
import { FormeTransfert, TypeDifferee } from './enums.ts'
import { Manifeste, type Question } from './manifeste.ts'

export interface Probleme {
  /** Chemin du champ en cause, par exemple `differees[3].forme`. Vide pour le manifeste entier. */
  readonly chemin: string
  readonly message: string
}

export type ResultatManifeste =
  | { readonly ok: true; readonly manifeste: Manifeste }
  | { readonly ok: false; readonly problemes: readonly Probleme[] }

function cheminDe(segments: readonly PropertyKey[]): string {
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
function messageDeStructure(probleme: z.core.$ZodRawIssue): string {
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

interface Reperee {
  readonly id: string
  readonly chemin: string
}

function ajouter(problemes: Probleme[], chemin: string, message: string): void {
  problemes.push({ chemin, message })
}

function reperer(liste: readonly { readonly id: string }[], nom: string): readonly Reperee[] {
  return liste.map((element, i) => ({ id: element.id, chemin: `${nom}[${String(i)}].id` }))
}

/** Tous les identifiants du manifeste, avec leur chemin. */
function identifiants(manifeste: Manifeste): readonly Reperee[] {
  return [
    ...reperer(manifeste.sources, 'sources'),
    ...reperer(manifeste.etapes, 'etapes'),
    ...reperer(manifeste.erreurs_critiques, 'erreurs_critiques'),
    ...reperer(manifeste.restitution, 'restitution'),
    ...reperer(manifeste.consolidation, 'consolidation'),
    ...reperer(manifeste.rappel, 'rappel'),
    ...reperer(manifeste.differees, 'differees'),
    ...reperer(manifeste.pratique, 'pratique'),
    ...manifeste.pratique.flatMap((pratique, i) =>
      reperer(pratique.items, `pratique[${String(i)}].items`),
    ),
    ...(manifeste.atelier === undefined
      ? []
      : [{ id: manifeste.atelier.id, chemin: 'atelier.id' }]),
    ...reperer(manifeste.cartes, 'cartes'),
  ]
}

function verifierIdentifiantsUniques(manifeste: Manifeste, problemes: Probleme[]): void {
  const vus = new Map<string, string>()
  for (const { id, chemin } of identifiants(manifeste)) {
    const premier = vus.get(id)
    if (premier === undefined) {
      vus.set(id, chemin)
      continue
    }
    // Une consolidation qui reprend une question de restitution a sa propre règle.
    const memeQuestion =
      (premier.startsWith('restitution') && chemin.startsWith('consolidation')) ||
      (premier.startsWith('consolidation') && chemin.startsWith('restitution'))
    if (!memeQuestion) {
      ajouter(problemes, chemin, `L’identifiant « ${id} » est déjà utilisé (${premier}).`)
    }
  }
}

/** Texte comparé sans tenir compte de la casse ni des espaces en trop. */
function normaliserTexte(texte: string): string {
  return texte.trim().replace(/\s+/g, ' ').toLowerCase()
}

function verifierNombreDeQuestions(manifeste: Manifeste, problemes: Probleme[]): void {
  const restitution = manifeste.restitution.length
  if (restitution < 5 || restitution > 6) {
    ajouter(
      problemes,
      'restitution',
      `La restitution doit avoir 5 ou 6 questions (il y en a ${String(restitution)}).`,
    )
  }
  if (manifeste.consolidation.length < 3) {
    ajouter(
      problemes,
      'consolidation',
      `La consolidation doit avoir au moins 3 questions (il y en a ${String(manifeste.consolidation.length)}).`,
    )
  }
  if (manifeste.rappel.length < 6) {
    ajouter(
      problemes,
      'rappel',
      `Le rappel doit avoir au moins 6 questions (il y en a ${String(manifeste.rappel.length)}).`,
    )
  }
}

function verifierConsolidationDistincte(manifeste: Manifeste, problemes: Probleme[]): void {
  const identifiantsRestitution = new Set(manifeste.restitution.map((q) => q.id))
  const textesRestitution = new Set(manifeste.restitution.map((q) => normaliserTexte(q.question)))
  manifeste.consolidation.forEach((question, i) => {
    if (identifiantsRestitution.has(question.id)) {
      ajouter(
        problemes,
        `consolidation[${String(i)}].id`,
        `La question de consolidation « ${question.id} » reprend l’identifiant d’une question de restitution.`,
      )
    }
    if (textesRestitution.has(normaliserTexte(question.question))) {
      ajouter(
        problemes,
        `consolidation[${String(i)}].question`,
        'Cette question de consolidation reprend le texte d’une question de restitution.',
      )
    }
  })
}

function verifierDifferees(manifeste: Manifeste, problemes: Probleme[]): void {
  for (const type of TypeDifferee.options) {
    const nombre = manifeste.differees.filter((d) => d.type === type).length
    if (nombre < 3) {
      ajouter(
        problemes,
        'differees',
        `Il faut au moins 3 questions différées de type « ${type} » (il y en a ${String(nombre)}).`,
      )
    }
  }

  const formesVues = new Set(
    manifeste.differees.flatMap((d) =>
      d.type === 'transfert' && d.forme !== undefined ? [d.forme] : [],
    ),
  )
  for (const forme of FormeTransfert.options) {
    if (!formesVues.has(forme)) {
      ajouter(
        problemes,
        'differees',
        `Les transferts doivent couvrir les 4 formes : il manque « ${forme} ».`,
      )
    }
  }

  manifeste.differees.forEach((differee, i) => {
    const chemin = `differees[${String(i)}]`
    if (differee.type === 'tache' && differee.verification === undefined) {
      ajouter(problemes, `${chemin}.verification`, 'Une tâche doit avoir une vérification.')
    }
    if (differee.type === 'transfert' && differee.forme === undefined) {
      ajouter(problemes, `${chemin}.forme`, 'Un transfert doit avoir une forme.')
    }
    if (differee.type !== 'transfert' && differee.forme !== undefined) {
      ajouter(problemes, `${chemin}.forme`, 'Seul un transfert a une forme.')
    }
  })
}

function verifierErreursCitees(manifeste: Manifeste, problemes: Probleme[]): void {
  const connues = new Set(manifeste.erreurs_critiques.map((erreur) => erreur.id))
  const verifier = (liste: readonly { readonly erreurs: readonly string[] }[], nom: string) => {
    liste.forEach((element, i) => {
      element.erreurs.forEach((erreur, j) => {
        if (!connues.has(erreur)) {
          ajouter(
            problemes,
            `${nom}[${String(i)}].erreurs[${String(j)}]`,
            `L’erreur critique « ${erreur} » n’existe pas dans erreurs_critiques.`,
          )
        }
      })
    })
  }
  const questions: readonly (readonly [readonly Question[], string])[] = [
    [manifeste.restitution, 'restitution'],
    [manifeste.consolidation, 'consolidation'],
    [manifeste.rappel, 'rappel'],
  ]
  for (const [liste, nom] of questions) verifier(liste, nom)
  verifier(manifeste.differees, 'differees')
}

function verifierPratique(manifeste: Manifeste, problemes: Probleme[]): void {
  manifeste.pratique.forEach((pratique, i) => {
    const total = pratique.items.length
    if (pratique.reussite < 1 || pratique.reussite > total) {
      ajouter(
        problemes,
        `pratique[${String(i)}].reussite`,
        `Le seuil de réussite doit être entre 1 et le nombre d’items (${String(total)}).`,
      )
    }
  })
}

function verifierPrerequis(manifeste: Manifeste, problemes: Probleme[]): void {
  if (manifeste.prerequis.includes(manifeste.bloc)) {
    ajouter(
      problemes,
      'prerequis',
      `Le bloc ${manifeste.bloc} ne peut pas être son propre prérequis.`,
    )
  }
}

/**
 * Vérifie un manifeste : sa structure, puis toutes les règles du cadrage.
 * Rend tous les problèmes d'un coup. Tant que la structure est fausse, seuls les problèmes
 * de structure sont rendus : les règles supposent une structure correcte.
 */
export function validerManifeste(donnees: unknown): ResultatManifeste {
  const structure = Manifeste.safeParse(donnees, { error: messageDeStructure })
  if (!structure.success) {
    return {
      ok: false,
      problemes: structure.error.issues.map((probleme) => ({
        chemin: cheminDe(probleme.path),
        message: probleme.message,
      })),
    }
  }

  const manifeste = structure.data
  const problemes: Probleme[] = []
  verifierIdentifiantsUniques(manifeste, problemes)
  verifierNombreDeQuestions(manifeste, problemes)
  verifierConsolidationDistincte(manifeste, problemes)
  verifierDifferees(manifeste, problemes)
  verifierErreursCitees(manifeste, problemes)
  verifierPratique(manifeste, problemes)
  verifierPrerequis(manifeste, problemes)
  return problemes.length === 0 ? { ok: true, manifeste } : { ok: false, problemes }
}
