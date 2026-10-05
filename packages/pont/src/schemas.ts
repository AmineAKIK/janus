import * as z from 'zod/mini'

// Les messages du pont, en `zod/mini` pour que la bibliothèque reste un seul petit fichier.
// Ce sont les mêmes règles que `packages/contrats/src/pont.ts` ; `schemas.test.ts` le vérifie
// message par message, pour que les deux ne divergent jamais.

const TAILLE_MAX_REPONSE = 2000
const TAILLE_MAX_ETAT_OCTETS = 200_000

const identifiant = () => z.string().check(z.trim(), z.minLength(1))
const codeBloc = () => z.string().check(z.regex(/^[A-Z]{1,3}\d{2,3}$/))
const reponse = () => z.string().check(z.maxLength(TAILLE_MAX_REPONSE))
const idUuid = () => z.uuid({ version: 'v7' })
const entierMin = (minimum: number) => z.int().check(z.gte(minimum))

const statut = z.enum([
  'non_commence',
  'en_cours',
  'vu',
  'acquis_provisoirement',
  'acquis',
  'maitrise',
  'a_reprendre',
])
const niveau = z.enum(['solide', 'partiel', 'fragile', 'pas_encore'])
const confiance = z.enum(['sur', 'hesitant', 'hasard'])
const source = z.enum(['support', 'deduit', 'ajoute'])
const certitude = z.enum(['sur', 'non_verifie'])
const raisonNonCompte = z.enum(['relance', 'avec_support', 'recopiee', 'non_verifiee'])
const aide = z.literal([0, 1, 2, 3, 4])
const codeManque = z.enum([
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

const manque = z.strictObject({
  code: codeManque,
  questions: z.optional(z.array(identifiant())),
  exercices: z.optional(z.array(identifiant())),
  erreurs: z.optional(z.array(identifiant())),
  apres: z.optional(z.string()),
  points: z.optional(z.number()),
  requis: z.optional(z.number()),
})

const etatPage = z.record(z.string(), z.json()).check(
  z.refine(
    (etat) => new TextEncoder().encode(JSON.stringify(etat)).length <= TAILLE_MAX_ETAT_OCTETS,
    {
      error: 'L’état de la page ne doit pas dépasser 200 ko.',
    },
  ),
)

const communPage = {
  id: idUuid(),
  bloc: codeBloc(),
  version: entierMin(1),
  t: z.iso.datetime({ offset: true }),
}

const seriePage = z.enum(['restitution', 'consolidation'])

/** Un message de la page vers l'appli. */
export const MessagePage = z.discriminatedUnion('type', [
  z.strictObject({ ...communPage, type: z.literal('page.prete'), schema: z.literal(2) }),
  z.strictObject({ ...communPage, type: z.literal('etape.vue'), etape: identifiant() }),
  z.strictObject({
    ...communPage,
    type: z.literal('pretest.reponse'),
    question: identifiant(),
    reponse: reponse(),
  }),
  z.strictObject({
    ...communPage,
    type: z.literal('pratique.resultat'),
    exercice: identifiant(),
    item: identifiant(),
    reussi: z.boolean(),
    aide,
    essais: entierMin(1),
  }),
  z.strictObject({
    ...communPage,
    type: z.literal('atelier.resultat'),
    reussi: z.boolean(),
    predictions_justes: entierMin(0),
    aide,
  }),
  z.strictObject({
    ...communPage,
    type: z.literal('aisance.resultat'),
    reussi: z.boolean(),
    duree_s: z.number().check(z.gte(0)),
  }),
  z.strictObject({
    ...communPage,
    type: z.literal('restitution.demande'),
    serie: seriePage,
    question: identifiant(),
    reponse: z.string().check(z.minLength(1), z.maxLength(TAILLE_MAX_REPONSE)),
    confiance,
    relance: reponse(),
    support: z.strictObject({ colle: z.boolean(), retour_cours: z.boolean() }),
  }),
  z.strictObject({ ...communPage, type: z.literal('bilan.erreurs'), ids: z.array(identifiant()) }),
  z.strictObject({ ...communPage, type: z.literal('etat.sauver'), etat: etatPage }),
  z.strictObject({
    ...communPage,
    type: z.literal('correction.accord'),
    correction: idUuid(),
    accord: z.boolean(),
  }),
])
export type MessagePage = z.infer<typeof MessagePage>

const champsCorrection = {
  id: idUuid(),
  echantillon: z.boolean(),
  question: identifiant(),
  tour: entierMin(1),
  message: z.string(),
  niveau,
  erreurs_critiques: z.array(identifiant()),
  source,
  ref: z.string(),
  certitude,
  compte: z.boolean(),
  raison_non_compte: z.optional(raisonNonCompte),
}
export const CorrectionRecue = z.strictObject(champsCorrection)
export type CorrectionRecue = z.infer<typeof CorrectionRecue>

/** Un message de l'appli vers la page. */
export const MessageAppli = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('etat.init'),
    bloc: codeBloc(),
    version: entierMin(1),
    etat: z.nullable(etatPage),
    statut,
    serie_ouverte: z.strictObject({ restitution: z.boolean(), consolidation: z.boolean() }),
  }),
  z.strictObject({ type: z.literal('restitution.correction'), ...champsCorrection }),
  z.strictObject({ type: z.literal('statut.maj'), statut, manque: z.array(manque) }),
  z.strictObject({
    type: z.literal('erreur'),
    code: z.enum(['correction_indisponible', 'plafond_atteint', 'message_refuse']),
    detail: z.string(),
    message_id: z.optional(idUuid()),
  }),
  z.strictObject({ type: z.literal('etape.aller'), etape: identifiant() }),
])
export type MessageAppli = z.infer<typeof MessageAppli>
