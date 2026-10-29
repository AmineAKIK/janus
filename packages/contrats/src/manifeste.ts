import { z } from 'zod'
import { CodeBloc, Identifiant, Texte } from './primitives.ts'
import { TypeDeContenu } from './composition.ts'
import { FormeTransfert, TypeDifferee } from './enums.ts'

const Entier = z.number().int()

/**
 * Les types d'étape d'une fiche, dans l'ordre du cycle de la méthode (percevoir, tenter, modéliser,
 * faire, recevoir un retour, ajuster). Les étapes de cours (`carte`, `perception`, `pretest`,
 * `explication`, `pratique`, `atelier`, `aisance`, `ensemble`) sont masquées pendant la restitution ;
 * `perception`, `pretest`, `explication`, `ensemble`, `atelier` et `aisance` lisent leur contenu dans un
 * `<template data-etape>` de la page. Les quatre moments qui les regroupent sont dans `moments.ts`.
 */
export const TypeEtape = z.enum([
  'carte',
  /** L'apprenant voit ou entend le système fonctionner en entier, sans rien produire, et finit par un pari. */
  'perception',
  'pretest',
  'explication',
  'pratique',
  'atelier',
  'aisance',
  /** Ajuster, en fin de bloc (règle C08) : après la pratique, le pari du début repris et corrigé, puis le schéma refait de mémoire. */
  'ensemble',
  'restitution',
  'bilan',
])
export type TypeEtape = z.infer<typeof TypeEtape>

const Question = z.strictObject({
  id: Identifiant,
  question: Texte,
  attendu: Texte,
  /** Identifiants des erreurs critiques que la question touche. */
  erreurs: z.array(Identifiant),
})
export type Question = z.infer<typeof Question>

/**
 * Une réponse en table de vérité : les faits d'entrée (`entrees`), que la page range comme on compte
 * en binaire (FAUX avant VRAI, le premier fait change le moins souvent), et les colonnes que
 * l'apprenant remplit, VRAI ou FAUX par case. La réponse part en texte, une ligne par cas :
 * « A FAUX, B FAUX : NON B VRAI ; A OU NON B VRAI ». Trois faits au plus (huit lignes).
 */
export const SaisieTable = z.strictObject({
  type: z.literal('table'),
  entrees: z.array(Texte).min(1).max(3),
  colonnes: z.array(Texte).min(1).max(3),
})
export type SaisieTable = z.infer<typeof SaisieTable>

/**
 * Une question de restitution. `saisie` : la forme de la réponse, quand ce n'est pas un texte libre
 * (une table de vérité). Seule la page sait la dessiner : le rappel et les différées, posés par
 * l'appli, restent en texte.
 */
const QuestionRestitution = z.strictObject({
  ...Question.shape,
  saisie: SaisieTable.optional(),
})
export type QuestionRestitution = z.infer<typeof QuestionRestitution>

/**
 * Une explication demandée dans un item de pratique (`data-justifier`), que l'IA juge sur `attendu`.
 * `id` est la clé de l'explication dans la page : l'item (`PR7-1`), ou l'item suivi de `:variante`
 * quand la variante a la sienne. L'item ne compte réussi qu'avec une explication jugée Solide.
 */
const Explication = z.strictObject({
  ...Question.shape,
  /** L'item de pratique que l'explication conclut. */
  item: Identifiant,
})
export type Explication = z.infer<typeof Explication>

/** Une tâche vérifiée par code : le langage et les cas de test que l'exécuteur rejoue. */
export const VerificationParCode = z.strictObject({
  mode: z.literal('code'),
  langage: z.literal('js'),
  cas: z.array(z.strictObject({ entree: z.array(z.unknown()), sortie: z.unknown() })).min(1),
})

/**
 * Une tâche dont le résultat s'observe sans que l'appli puisse le contrôler (une maquette, une
 * installation) : des critères fixés avant, que l'apprenant coche, avec son niveau d'aide.
 */
export const VerificationParConstat = z.strictObject({
  mode: z.literal('constat'),
  criteres: z.array(Texte).min(1),
})

/** Comment l'appli vérifie une tâche : comparaison de texte, exécution de cas de test, ou constat déclaré. */
export const Verification = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('exacte'), reponses: z.array(Texte).min(1) }),
  VerificationParCode,
  VerificationParConstat,
])
export type Verification = z.infer<typeof Verification>

const Differee = z.strictObject({
  id: Identifiant,
  type: TypeDifferee,
  forme: FormeTransfert.optional(),
  consigne: Texte,
  attendu: Texte,
  erreurs: z.array(Identifiant),
  verification: Verification.optional(),
})
export type Differee = z.infer<typeof Differee>

const Pratique = z.strictObject({
  id: Identifiant,
  titre: Texte,
  items: z.array(z.strictObject({ id: Identifiant })),
  reussite: Entier,
})

/** Manifeste d'une fiche, version 2 du cadrage. Les règles qui lient plusieurs champs sont dans `validerManifeste`. */
export const Manifeste = z.strictObject({
  schema: z.literal(2),
  bloc: CodeBloc,
  /** Type de contenu : décide des réserves exigées et des types tirés à la vérification. Absent : composition complète. */
  type: TypeDeContenu.optional(),
  version: Entier.min(1),
  titre: Texte,
  titre_court: Texte,
  objectif: Texte,
  prerequis: z.array(CodeBloc),
  pont: Entier.min(1),
  contexte_ia: Texte,
  sources: z.array(z.strictObject({ id: Identifiant, titre: Texte })),
  etapes: z.array(z.strictObject({ id: Identifiant, titre: Texte, type: TypeEtape })),
  erreurs_critiques: z.array(
    z.strictObject({ id: Identifiant, libelle: Texte, etape: Identifiant.optional() }),
  ),
  restitution: z.array(QuestionRestitution),
  /** Les explications des items de pratique, jugées par l'IA. Absent des manifestes d'avant : aucune. */
  explication: z.array(Explication).default([]),
  rappel: z.array(Question),
  differees: z.array(Differee),
  pratique: z.array(Pratique),
  /**
   * L'atelier : ce qui se fait hors de la page (sur sa machine, dans un autre logiciel), guidé par
   * son `<template data-etape>`, puis constaté par l'apprenant sur des critères fixés d'avance, avec
   * l'aide prise. Absent des manifestes d'avant : un seul critère, l'atelier fait en entier.
   */
  atelier: z
    .strictObject({
      id: Identifiant,
      reussite_aide_max: z.literal(0),
      criteres: z.array(Texte).min(1).optional(),
    })
    .optional(),
  /**
   * La cible d'aisance : des paliers, une durée maximale en secondes par série réussie, dans l'ordre.
   * Une série réussie dans le temps du palier courant le valide ; un palier par jour au plus ; la
   * cible est atteinte au dernier palier. B01 : `[30, 20, 10]` ; une cible sans progression : `[25, 25, 25]`.
   */
  aisance: z
    .strictObject({
      libelle: Texte,
      paliers_s: z.array(Entier.min(1)).min(1),
    })
    .optional(),
  cartes: z.array(z.strictObject({ id: Identifiant, recto: Texte, verso: Texte })),
})
export type Manifeste = z.infer<typeof Manifeste>
