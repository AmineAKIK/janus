import { z } from 'zod'
import { Aide, Certitude, Confiance, Niveau, RaisonNonCompte, Source, Statut } from './enums.ts'

// Les messages entre une fiche (iframe sandbox) et l'appli, section « Pont » du cadrage.
// Les noms des champs sont ceux du cadrage (`duree_s`, `serie_ouverte`...), comme dans le manifeste.

/** Taille maximale d'une réponse libre, en caractères. */
export const TAILLE_MAX_REPONSE = 2000
/** Taille maximale de l'état d'une page une fois écrit en JSON (200 ko), en octets. */
export const TAILLE_MAX_ETAT_OCTETS = 200_000

export const Identifiant = z.string().trim().min(1)
export const CodeBloc = z.string().regex(/^[A-Z]{1,3}\d{2,3}$/)
export const Reponse = z.string().max(TAILLE_MAX_REPONSE)
/** Un identifiant tiré par le client, UUID v7. */
export const IdUuid = z.uuid({ version: 'v7' })

/** Les codes de ce qui manque pour le statut suivant, rendus par le moteur ; l'interface les traduit en phrases. */
export const CodeManque = z.enum([
  'restitution_incomplete',
  'consolidation_trop_tot',
  'consolidation_a_faire',
  'consolidation_cours_rouvert',
  'consolidation_insuffisante',
  'pratique_aide',
  'atelier_manquant',
  'erreur_ouverte',
  'verification_a_venir',
  'verification_a_faire',
  'retest_a_venir',
  'retest_a_faire',
  'aisance_non_atteinte',
])
export type CodeManque = z.infer<typeof CodeManque>

/** Un manque et ses paramètres : questions, exercices ou erreurs concernés, date possible, points obtenus et requis. */
export const Manque = z.strictObject({
  code: CodeManque,
  questions: z.array(Identifiant).optional(),
  exercices: z.array(Identifiant).optional(),
  erreurs: z.array(Identifiant).optional(),
  apres: z.string().optional(),
  points: z.number().optional(),
  requis: z.number().optional(),
})
export type Manque = z.infer<typeof Manque>

/** L'état d'une page : un objet JSON de 200 ko au plus. */
export const EtatPage = z
  .record(z.string(), z.json())
  .refine(
    (etat) => new TextEncoder().encode(JSON.stringify(etat)).length <= TAILLE_MAX_ETAT_OCTETS,
    {
      error: 'L’état de la page ne doit pas dépasser 200 ko.',
    },
  )

/** Ce que tout message de la page porte : un identifiant unique, le bloc, la version du manifeste et l'heure du téléphone (indicative). */
const communPage = {
  id: IdUuid,
  bloc: CodeBloc,
  version: z.number().int().min(1),
  t: z.iso.datetime({ offset: true }),
}

const SeriePage = z.enum(['restitution', 'consolidation'])

/** Un message de la page vers l'appli (`window.parent.postMessage`). Le serveur date tout avec sa propre heure. */
export const MessagePage = z.discriminatedUnion('type', [
  z.strictObject({ ...communPage, type: z.literal('page.prete'), schema: z.literal(2) }),
  z.strictObject({ ...communPage, type: z.literal('etape.vue'), etape: Identifiant }),
  z.strictObject({
    ...communPage,
    type: z.literal('pretest.reponse'),
    question: Identifiant,
    reponse: Reponse,
  }),
  z.strictObject({
    ...communPage,
    type: z.literal('pratique.resultat'),
    exercice: Identifiant,
    item: Identifiant,
    reussi: z.boolean(),
    aide: Aide,
    essais: z.number().int().min(1),
  }),
  z.strictObject({
    ...communPage,
    type: z.literal('atelier.resultat'),
    reussi: z.boolean(),
    predictions_justes: z.number().int().min(0),
    aide: Aide,
  }),
  z.strictObject({
    ...communPage,
    type: z.literal('aisance.resultat'),
    reussi: z.boolean(),
    duree_s: z.number().min(0),
  }),
  z.strictObject({
    ...communPage,
    type: z.literal('restitution.demande'),
    serie: SeriePage,
    question: Identifiant,
    reponse: Reponse.min(1),
    confiance: Confiance,
    /** Le texte de la relance, vide au premier tour. */
    relance: Reponse,
    support: z.strictObject({ colle: z.boolean(), retour_cours: z.boolean() }),
  }),
  z.strictObject({ ...communPage, type: z.literal('bilan.erreurs'), ids: z.array(Identifiant) }),
  z.strictObject({ ...communPage, type: z.literal('etat.sauver'), etat: EtatPage }),
  z.strictObject({
    ...communPage,
    type: z.literal('correction.accord'),
    /** L'identifiant de la correction jugée. */
    correction: IdUuid,
    accord: z.boolean(),
  }),
])
export type MessagePage = z.infer<typeof MessagePage>

/** Une correction rendue par le serveur : ce que la page affiche, et que l'API de corrections renvoie. */
const champsCorrection = {
  /** L'identifiant de la correction, que la page renvoie dans `correction.accord`. */
  id: IdUuid,
  /** Vrai pour une correction de premier tour sur dix : la page demande alors l'avis d'Amine. */
  echantillon: z.boolean(),
  question: Identifiant,
  tour: z.number().int().min(1),
  message: z.string(),
  niveau: Niveau,
  erreurs_critiques: z.array(Identifiant),
  source: Source,
  ref: z.string(),
  certitude: Certitude,
  compte: z.boolean(),
  raison_non_compte: RaisonNonCompte.optional(),
}
export const CorrectionRecue = z.strictObject(champsCorrection)
export type CorrectionRecue = z.infer<typeof CorrectionRecue>

/** Un message de l'appli vers la page. */
export const MessageAppli = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('etat.init'),
    /** Le bloc et la version du manifeste : en mode appli, la fiche les utilise à la place de ceux de son manifeste embarqué. */
    bloc: CodeBloc,
    version: z.number().int().min(1),
    /** L'état sauvegardé, `null` s'il n'y en a pas encore. */
    etat: EtatPage.nullable(),
    statut: Statut,
    serie_ouverte: z.strictObject({ restitution: z.boolean(), consolidation: z.boolean() }),
  }),
  z.strictObject({ type: z.literal('restitution.correction'), ...champsCorrection }),
  z.strictObject({
    type: z.literal('statut.maj'),
    statut: Statut,
    manque: z.array(Manque),
  }),
  z.strictObject({
    type: z.literal('erreur'),
    code: z.enum(['correction_indisponible', 'plafond_atteint', 'message_refuse']),
    detail: z.string(),
    /** L'identifiant du message de la page qui a été refusé, s'il y en a un. */
    message_id: IdUuid.optional(),
  }),
  z.strictObject({
    type: z.literal('etape.aller'),
    /** L'étape à afficher (fil d'étapes de l'appli). */
    etape: Identifiant,
  }),
])
export type MessageAppli = z.infer<typeof MessageAppli>
