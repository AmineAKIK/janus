import { z } from 'zod'
import { CodeBloc, Identifiant, Texte } from './primitives.ts'
import { TypeDeContenu } from './composition.ts'
import { FormeTransfert, TypeDifferee } from './enums.ts'

const Entier = z.number().int()

/**
 * Les types d'étape d'une fiche, dans l'ordre du cycle de la méthode (percevoir, tenter, modéliser,
 * faire, recevoir un retour, ajuster). Les étapes de cours (`carte`, `perception`, `pretest`,
 * `explication`, `ensemble`, `pratique`, `atelier`, `aisance`) sont masquées pendant la restitution ;
 * `perception`, `pretest`, `explication`, `ensemble` et `aisance` lisent leur contenu dans un
 * `<template data-etape>` de la page. Les quatre moments qui les regroupent sont dans `moments.ts`.
 */
export const TypeEtape = z.enum([
  'carte',
  /** L'apprenant voit ou entend le système fonctionner en entier, sans rien produire, et finit par un pari. */
  'perception',
  'pretest',
  'explication',
  /** Le retour à l'ensemble en fin de cours : le schéma complété de mémoire, le pari du début repris et corrigé, avant la pratique. */
  'ensemble',
  'pratique',
  'atelier',
  'aisance',
  'restitution',
  'consolidation',
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
  restitution: z.array(Question),
  consolidation: z.array(Question),
  rappel: z.array(Question),
  differees: z.array(Differee),
  pratique: z.array(Pratique),
  atelier: z.strictObject({ id: Identifiant, reussite_aide_max: z.literal(0) }).optional(),
  aisance: z
    .strictObject({
      libelle: Texte,
      duree_max_s: Entier.min(1),
      reussites_requises: Entier.min(1),
      sur_jours_differents: Entier.min(1),
    })
    .optional(),
  cartes: z.array(z.strictObject({ id: Identifiant, recto: Texte, verso: Texte })),
})
export type Manifeste = z.infer<typeof Manifeste>
