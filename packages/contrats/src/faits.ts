import { z } from 'zod'
import {
  Aide,
  Confiance,
  Niveau,
  RaisonNonCompte,
  Serie,
  Statut,
  TypeVerification,
} from './enums.ts'

const Texte = z.string().trim().min(1)
const Identifiant = z.string().trim().min(1)
const Tour = z.number().int().min(1)

/** Un instant ISO 8601 en UTC, par exemple `2026-06-01T10:00:00Z` (les millisecondes sont permises). */
export const InstantUtc = z.iso.datetime({
  error: 'La date doit être un instant ISO 8601 en UTC, par exemple 2026-06-01T10:00:00Z.',
})

const commun = {
  id: Identifiant,
  /** Code du bloc, par exemple `B02`. */
  bloc: Identifiant,
  /** Date donnée par le serveur, jamais l'heure du téléphone. */
  date: InstantUtc,
}

const base = { question: Identifiant, tour: Tour, compte: z.boolean() }

/** Une réponse donnée pendant une vérification, un retest ou un entretien : le niveau pour une explication ou un transfert, la réussite pour une tâche. */
export const ReponseVerification = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('explication'), ...base, niveau: Niveau.optional() }),
  z.strictObject({ type: z.literal('transfert'), ...base, niveau: Niveau.optional() }),
  z.strictObject({ type: z.literal('tache'), ...base, reussi: z.boolean().optional() }),
])
export type ReponseVerification = z.infer<typeof ReponseVerification>

const SourceErreur = z.enum(['amine', 'ia_confirmee'])

/**
 * Tout ce que le serveur a enregistré sur un bloc. Le statut se recalcule toujours depuis ces faits ;
 * ils entrent donc par ce schéma avant d'être donnés au moteur.
 */
export const Fait = z.discriminatedUnion('type', [
  z.strictObject({
    ...commun,
    type: z.literal('bloc_ouvert'),
    horsPrerequis: z.boolean(),
    raison: Texte.optional(),
  }),
  z.strictObject({ ...commun, type: z.literal('etape_vue'), etape: Identifiant }),
  z.strictObject({
    ...commun,
    type: z.literal('pratique_resultat'),
    exercice: Identifiant,
    item: Identifiant,
    reussi: z.boolean(),
    aide: Aide,
  }),
  z.strictObject({
    ...commun,
    type: z.literal('atelier_resultat'),
    reussi: z.boolean(),
    aide: Aide,
  }),
  z.strictObject({
    ...commun,
    type: z.literal('aisance_resultat'),
    reussi: z.boolean(),
    dureeS: z.number().min(0),
  }),
  z.strictObject({
    ...commun,
    type: z.literal('correction'),
    serie: Serie,
    question: Identifiant,
    tour: Tour,
    niveau: Niveau,
    compte: z.boolean(),
    raisonNonCompte: RaisonNonCompte.optional(),
    confiance: Confiance,
    /** Erreurs repérées par l'IA : elles n'ouvrent rien tant qu'Amine ne les coche pas. */
    erreursIa: z.array(Identifiant),
  }),
  z.strictObject({
    ...commun,
    type: z.literal('correction_tranchee'),
    correction: Identifiant,
    compte: z.boolean(),
    niveau: Niveau.optional(),
    raison: z.string().trim().min(10).optional(),
  }),
  z.strictObject({
    ...commun,
    type: z.literal('erreur_ia_tranchee'),
    correction: Identifiant,
    erreur: Identifiant,
    decision: z.enum(['confirmee', 'rejetee']),
  }),
  z.strictObject({
    ...commun,
    type: z.literal('verification_terminee'),
    verification: TypeVerification,
    valable: z.boolean(),
    raisonInvalide: Texte.optional(),
    reponses: z.array(ReponseVerification),
  }),
  z.strictObject({
    ...commun,
    type: z.literal('erreur_cochee'),
    erreur: Identifiant,
    source: SourceErreur,
  }),
  z.strictObject({
    ...commun,
    type: z.literal('erreur_decochee'),
    erreur: Identifiant,
    source: SourceErreur,
  }),
  z.strictObject({ ...commun, type: z.literal('statut_force'), statut: Statut, raison: Texte }),
  z.strictObject({ ...commun, type: z.literal('force_levee') }),
])
export type Fait = z.infer<typeof Fait>
