import { reservesDuType } from './composition.ts'
import { Manifeste, type Question } from './manifeste.ts'
import { cheminDe, messageDeStructure } from './structure.ts'

export interface Probleme {
  /** Chemin du champ en cause, par exemple `differees[3].forme`. Vide pour le manifeste entier. */
  readonly chemin: string
  readonly message: string
}

export type ResultatManifeste =
  | { readonly ok: true; readonly manifeste: Manifeste }
  | { readonly ok: false; readonly problemes: readonly Probleme[] }

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
    ajouter(problemes, chemin, `L’identifiant « ${id} » est déjà utilisé (${premier}).`)
  }
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
  if (manifeste.rappel.length < 6) {
    ajouter(
      problemes,
      'rappel',
      `Le rappel doit avoir au moins 6 questions (il y en a ${String(manifeste.rappel.length)}).`,
    )
  }
}

function verifierDifferees(manifeste: Manifeste, problemes: Probleme[]): void {
  const reserves = reservesDuType(manifeste.type)
  for (const type of reserves.parties) {
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
  for (const forme of reserves.formes) {
    if (!formesVues.has(forme)) {
      ajouter(
        problemes,
        'differees',
        `Les transferts doivent couvrir les ${String(reserves.formes.length)} formes : il manque « ${forme} ».`,
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
    if (differee.type !== 'tache' && differee.verification !== undefined) {
      ajouter(problemes, `${chemin}.verification`, 'Seule une tâche a une vérification.')
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
    [manifeste.explication, 'explication'],
    [manifeste.rappel, 'rappel'],
  ]
  for (const [liste, nom] of questions) verifier(liste, nom)
  verifier(manifeste.differees, 'differees')
}

/**
 * Une erreur cochée au bilan ne se referme que par une réponse réussie à une question qui la touche :
 * la restitution est déjà passée ; seules les différées reviennent (vérification, retest). Sans différée qui la touche, l'erreur resterait ouverte.
 */
function verifierErreursFermables(manifeste: Manifeste, problemes: Probleme[]): void {
  const touchees = new Set(manifeste.differees.flatMap((differee) => differee.erreurs))
  manifeste.erreurs_critiques.forEach((erreur, i) => {
    if (!touchees.has(erreur.id)) {
      ajouter(
        problemes,
        `erreurs_critiques[${String(i)}]`,
        `L’erreur critique « ${erreur.id} » n’est touchée par aucune question différée : une fois cochée au bilan, seule une différée réussie (vérification, retest, entretien) pourrait la refermer.`,
      )
    }
  })
}

function verifierEtapesCitees(manifeste: Manifeste, problemes: Probleme[]): void {
  const connues = new Set(manifeste.etapes.map((etape) => etape.id))
  manifeste.erreurs_critiques.forEach((erreur, i) => {
    if (erreur.etape !== undefined && !connues.has(erreur.etape)) {
      ajouter(
        problemes,
        `erreurs_critiques[${String(i)}].etape`,
        `L’étape « ${erreur.etape} » n’existe pas dans etapes.`,
      )
    }
  })
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

/**
 * Une explication conclut un item de pratique qui existe, et sa clé n'y sert qu'une fois : la page la
 * retrouve par cette clé, le statut par l'item.
 */
function verifierExplications(manifeste: Manifeste, problemes: Probleme[]): void {
  const items = new Set(manifeste.pratique.flatMap(({ items: liste }) => liste.map(({ id }) => id)))
  const vues = new Set<string>()
  manifeste.explication.forEach((explication, i) => {
    if (vues.has(explication.id)) {
      ajouter(
        problemes,
        `explication[${String(i)}].id`,
        `L’explication « ${explication.id} » est déjà déclarée.`,
      )
    }
    vues.add(explication.id)
    if (!items.has(explication.item)) {
      ajouter(
        problemes,
        `explication[${String(i)}].item`,
        `L’item « ${explication.item} » n’existe dans aucune pratique.`,
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
  verifierDifferees(manifeste, problemes)
  verifierErreursCitees(manifeste, problemes)
  verifierErreursFermables(manifeste, problemes)
  verifierEtapesCitees(manifeste, problemes)
  verifierPratique(manifeste, problemes)
  verifierExplications(manifeste, problemes)
  verifierPrerequis(manifeste, problemes)
  return problemes.length === 0 ? { ok: true, manifeste } : { ok: false, problemes }
}
