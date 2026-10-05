import { z } from 'zod'
import { FormeTransfert, TypeDifferee } from './enums.ts'

const Texte = z.string().trim().min(1)
const Identifiant = z.string().trim().min(1)
const CodeBloc = z.string().regex(/^[A-Z]{1,3}\d{2,3}$/)
const Entier = z.number().int()

export const TypeEtape = z.enum([
  'carte',
  'pretest',
  'explication',
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

/** Comment l'appli vérifie une tâche : comparaison de texte, ou exécution de cas de test. */
export const Verification = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('exacte'), reponses: z.array(Texte).min(1) }),
  z.strictObject({
    mode: z.literal('code'),
    langage: z.literal('js'),
    cas: z.array(z.strictObject({ entree: z.array(z.unknown()), sortie: z.unknown() })).min(1),
  }),
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
