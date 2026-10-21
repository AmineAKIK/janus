import { z } from 'zod'
import { Statut } from '../enums.ts'
import { InstantUtc } from '../faits.ts'
import { Identifiant, Manque } from '../pont.ts'

export {
  Identifiant,
  IdUuid,
  CodeBloc,
  Reponse,
  CorrectionRecue,
  CorrectionRendue,
  champsReponse,
} from '../pont.ts'
export { InstantUtc }

/** Les codes stables des erreurs de l'API, repris dans `code` du `problem+json`. */
export const CodeProbleme = z.enum([
  'donnees_invalides',
  'non_authentifie',
  'origine_refusee',
  'refus',
  'introuvable',
  'conflit',
  'contenu_different',
  'trop_de_requetes',
  'budget_atteint',
  'precondition_echouee',
  'delai_depasse',
  'erreur_interne',
])
export type CodeProbleme = z.infer<typeof CodeProbleme>

/** Une erreur de l'API, au format `application/problem+json` (RFC 9457). */
export const ProblemeApi = z.strictObject({
  type: z.string().min(1),
  title: z.string().min(1),
  status: z.number().int().min(400).max(599),
  detail: z.string(),
  code: CodeProbleme,
})
export type ProblemeApi = z.infer<typeof ProblemeApi>

/** Ce que l'appli doit afficher d'un bloc après un fait : son statut et ce qui manque pour le suivant. */
/**
 * L'avancement d'un bloc, d'après les faits enregistrés : les étapes déjà affichées, et la date à
 * laquelle chaque étape à preuve a été prouvée (`null` tant qu'elle ne l'est pas, ou si la fiche
 * n'a pas cette étape). C'est ce que le fil d'étapes de l'appli coche.
 */
export const Avancement = z.strictObject({
  etapes_vues: z.array(Identifiant),
  /** Toutes les questions de restitution envoyées au premier tour. */
  restitution: InstantUtc.nullable(),
  /** Chaque exercice de pratique atteint à l'aide 0. */
  pratique: InstantUtc.nullable(),
  /** Atelier réussi à l'aide 0. */
  atelier: InstantUtc.nullable(),
  /** Cible d'aisance atteinte. */
  aisance: InstantUtc.nullable(),
})
export type Avancement = z.infer<typeof Avancement>

export const StatutBloc = z.strictObject({
  statut: Statut,
  manque: z.array(Manque),
  /** Identifiants des erreurs critiques ouvertes. */
  erreurs_ouvertes: z.array(Identifiant),
  avancement: Avancement,
})
export type StatutBloc = z.infer<typeof StatutBloc>

/** Un ensemble de parametres d'URL : `:id` seulement. */
export const ParamId = z.strictObject({ id: Identifiant })

/** Le texte libre d'une note, d'une idée ou d'une revue. */
export const TexteLibre = z.string().trim().min(1).max(10_000)
