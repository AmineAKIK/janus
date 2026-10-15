import { z } from 'zod'
import type { Manifeste } from './manifeste.ts'
import { CodeBloc, Identifiant, Texte } from './primitives.ts'
import { cheminDe, messageDeStructure } from './structure.ts'
import type { Probleme } from './validerManifeste.ts'

/**
 * Le tableau d'alignement d'une fiche (`<script id="alignement">`) : chaque notion de l'objectif,
 * l'étape qui la montre, ce qui l'entraîne, les questions et les cartes qui l'interrogent. Il s'écrit
 * avant la fiche et ne sert qu'à la vérifier : l'appli ne le lit pas.
 */
export const Alignement = z.strictObject({
  bloc: CodeBloc,
  notions: z
    .array(
      z.strictObject({
        id: Identifiant,
        /** Un savoir ou un savoir-faire de l'objectif, vérifiable. */
        notion: Texte,
        /** Les étapes d'explication qui la montrent. */
        montree: z.array(Identifiant).min(1),
        /** Les exercices de pratique, l'atelier ou l'étape d'aisance qui l'entraînent : liste vide si rien. */
        pratiquee: z.array(Identifiant),
        /** Les questions (restitution, consolidation, rappel, différées) et les cartes qui l'interrogent. */
        questions: z.array(Identifiant).min(1),
      }),
    )
    .min(1),
  /** Ce qui dépasse l'objectif : noté pour plus tard, jamais interrogé. */
  hors_objectif: z.array(Texte),
})
export type Alignement = z.infer<typeof Alignement>

/** Tout ce que la fiche demande à l'apprenant, par identifiant, avec la liste du manifeste qui le porte. */
function interrogations(manifeste: Manifeste): ReadonlyMap<string, string> {
  const listes = {
    restitution: manifeste.restitution,
    consolidation: manifeste.consolidation,
    rappel: manifeste.rappel,
    differees: manifeste.differees,
    cartes: manifeste.cartes,
  }
  return new Map(
    Object.entries(listes).flatMap(([liste, elements]) =>
      elements.map(({ id }) => [id, liste] as const),
    ),
  )
}

/**
 * Une fiche n'interroge que ce qu'elle enseigne, et n'enseigne que ce que son objectif promet. Le tableau
 * rattache chaque question et chaque carte à une notion, chaque notion à une étape qui la montre ; ce
 * qui ne se rattache à rien est refusé. Le contrôle porte sur les rattachements déclarés : que l'étape
 * enseigne vraiment la notion, c'est l'épreuve de l'apprenant neuf qui le dit (LISEZ-MOI du gabarit).
 */
export function validerAlignement(donnees: unknown, manifeste: Manifeste): readonly Probleme[] {
  const structure = Alignement.safeParse(donnees, { error: messageDeStructure })
  if (!structure.success) {
    return structure.error.issues.map((probleme) => ({
      chemin: cheminDe(probleme.path),
      message: probleme.message,
    }))
  }
  const alignement = structure.data
  const problemes: Probleme[] = []
  const signaler = (chemin: string, message: string) => problemes.push({ chemin, message })
  if (alignement.bloc !== manifeste.bloc) {
    signaler(
      'bloc',
      `Ce tableau est celui de ${alignement.bloc}, la fiche est celle de ${manifeste.bloc}.`,
    )
  }

  const explications = manifeste.etapes.filter(({ type }) => type === 'explication')
  const idsExplications = new Set(explications.map(({ id }) => id))
  const entrainements = new Set([
    ...manifeste.pratique.map(({ id }) => id),
    ...(manifeste.atelier === undefined ? [] : [manifeste.atelier.id]),
    ...manifeste.etapes
      .filter(({ type }) => type === 'aisance' || type === 'atelier')
      .map(({ id }) => id),
  ])
  const demandes = interrogations(manifeste)

  const notions = new Set<string>()
  const montrees = new Set<string>()
  const pratiquees = new Set<string>()
  const interrogees = new Set<string>()
  alignement.notions.forEach((notion, index) => {
    const chemin = `notions[${String(index)}]`
    if (notions.has(notion.id))
      signaler(`${chemin}.id`, `L’identifiant ${notion.id} est déjà pris.`)
    notions.add(notion.id)
    for (const id of notion.montree) {
      if (idsExplications.has(id)) montrees.add(id)
      else signaler(`${chemin}.montree`, `${id} n’est pas une étape d’explication de la fiche.`)
    }
    for (const id of notion.pratiquee) {
      if (entrainements.has(id)) pratiquees.add(id)
      else
        signaler(
          `${chemin}.pratiquee`,
          `${id} n’est ni un exercice de pratique, ni l’atelier, ni l’aisance de la fiche.`,
        )
    }
    for (const id of notion.questions) {
      if (demandes.has(id)) interrogees.add(id)
      else signaler(`${chemin}.questions`, `${id} n’est ni une question ni une carte du manifeste.`)
    }
  })

  for (const { id } of explications) {
    if (!montrees.has(id))
      signaler(
        '',
        `L’étape ${id} (explication) n’enseigne aucune notion de l’objectif : rattache-la à une notion, ou retire-la de la fiche.`,
      )
  }
  for (const { id } of manifeste.pratique) {
    if (!pratiquees.has(id))
      signaler(
        '',
        `L’exercice ${id} n’entraîne aucune notion de l’objectif : rattache-le à une notion, ou retire-le de la fiche.`,
      )
  }
  for (const [id, liste] of demandes) {
    if (!interrogees.has(id))
      signaler(
        '',
        `${id} (${liste}) n’est rattachée à aucune notion de l’objectif : une fiche n’interroge que ce qu’elle enseigne.`,
      )
  }
  return problemes
}
