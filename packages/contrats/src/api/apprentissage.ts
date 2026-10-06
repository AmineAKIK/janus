import { z } from 'zod'
import { NoteCarte, Statut, TypeDifferee, TypeVerification } from '../enums.ts'
import { InstantUtc } from '../faits.ts'
import { CodeBloc, IdUuid, Identifiant, Reponse } from './commun.ts'
import type { DefinitionRoute } from './routes.ts'

const Texte = z.string().trim().min(1)

/** Une tâche de l'écran Aujourd'hui, dans l'ordre où le moteur les range. */
export const Tache = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('reprendre_erreur'),
    bloc: CodeBloc,
    erreur: Identifiant,
    libelle: Texte,
    /** `/blocs/<id>`, suivi de `?etape=<etape>` quand le manifeste donne l'étape de l'erreur. */
    lien: Texte,
  }),
  z.strictObject({ type: z.literal('questions_debut'), nombre: z.number().int().min(1) }),
  z.strictObject({ type: z.literal('reprise'), blocs: z.array(CodeBloc) }),
  z.strictObject({
    type: z.enum(['verification', 'retest', 'entretien']),
    bloc: CodeBloc,
    /** Le jour `AAAA-MM-JJ` à partir duquel c'est dû. */
    apres: Texte,
  }),
  z.strictObject({ type: z.literal('consolidation'), bloc: CodeBloc, apres: InstantUtc }),
  z.strictObject({
    type: z.literal('cartes'),
    dues: z.number().int().min(0),
    nouvelles: z.number().int().min(0),
  }),
  z.strictObject({ type: z.literal('bloc'), bloc: CodeBloc }),
])
export type Tache = z.infer<typeof Tache>

/** Une tâche de la journée : la tâche du moteur, où elle mène et si elle est faite aujourd'hui. */
export const TacheDuJour = z.strictObject({
  tache: Tache,
  /** Le chemin de l'appli vers la tâche, par exemple `/blocs/B03`. */
  lien: Texte,
  /** Vrai quand la tâche a été faite dans la journée : elle reste alors dans la liste. */
  faite: z.boolean(),
})
export type TacheDuJour = z.infer<typeof TacheDuJour>

/** Un bloc du module en cours, avec son statut calculé. */
const BlocDuModule = z.strictObject({
  bloc: CodeBloc,
  titre_court: Texte,
  statut: Statut,
})

/** Une question de début de séance : sans le nom du bloc, pour que les blocs restent mélangés. */
const QuestionDebut = z.strictObject({ id: Identifiant, question: Texte })

const Carte = z.strictObject({ id: Identifiant, bloc: CodeBloc, recto: Texte, verso: Texte })

export const ROUTES_APPRENTISSAGE = {
  'GET /aujourdhui': {
    methode: 'GET',
    chemin: '/aujourdhui',
    reponse: z.strictObject({
      /** Le jour `AAAA-MM-JJ`, avec la bascule à l'heure réglée. */
      jour: Texte,
      en_retard: z.boolean(),
      /** Présent quand la dernière séance date d'au moins 7 jours. */
      retour: z.strictObject({ jours: z.number().int().min(7) }).optional(),
      /** Vrai tant qu'aucun fait n'est enregistré : la file n'a qu'une tâche, commencer le premier bloc. */
      premiere_connexion: z.boolean(),
      taches: z.array(TacheDuJour),
      /** Le module en cours, `null` si aucun n'est importé. */
      module: z
        .strictObject({ id: Identifiant, titre: Texte, blocs: z.array(BlocDuModule) })
        .nullable(),
    }),
    succes: 200,
  },
  'GET /questions-debut': {
    methode: 'GET',
    chemin: '/questions-debut',
    reponse: z.strictObject({ questions: z.array(QuestionDebut) }),
    succes: 200,
  },
  'GET /cartes/dues': {
    methode: 'GET',
    chemin: '/cartes/dues',
    reponse: z.strictObject({ dues: z.array(Carte), nouvelles: z.array(Carte) }),
    succes: 200,
  },
  'POST /cartes/:id/note': {
    methode: 'POST',
    chemin: '/cartes/:id/note',
    params: z.strictObject({ id: Identifiant }),
    corps: z.strictObject({ id: IdUuid, note: NoteCarte }),
    reponse: z.strictObject({ echeance: InstantUtc }),
    succes: 200,
  },
  'GET /verifications/:id': {
    methode: 'GET',
    chemin: '/verifications/:id',
    params: z.strictObject({ id: IdUuid }),
    reponse: z.strictObject({
      id: IdUuid,
      type: TypeVerification,
      /** Le jour `AAAA-MM-JJ` à partir duquel elle est due. */
      due_le: Texte,
      terminee: z.boolean(),
      /** Les questions tirées : sans le nom du bloc, qui n'apparaît qu'avec la correction. */
      questions: z.array(z.strictObject({ id: Identifiant, type: TypeDifferee, consigne: Texte })),
    }),
    succes: 200,
  },
  'POST /verifications/:id/reponses': {
    methode: 'POST',
    chemin: '/verifications/:id/reponses',
    params: z.strictObject({ id: IdUuid }),
    corps: z.strictObject({ id: IdUuid, question: Identifiant, reponse: Reponse.min(1) }),
    reponse: z.strictObject({
      question: Identifiant,
      tour: z.number().int().min(1),
      compte: z.boolean(),
      /** La tâche vérifiée automatiquement rend `reussi` ; une explication ou un transfert, le `niveau`. */
      reussi: z.boolean().optional(),
      niveau: z.enum(['solide', 'partiel', 'fragile', 'pas_encore']).optional(),
      /** Vrai quand toutes les questions ont une réponse : la vérification est terminée. */
      terminee: z.boolean(),
    }),
    succes: 200,
  },
  'POST /verifications/:id/reporter': {
    methode: 'POST',
    chemin: '/verifications/:id/reporter',
    params: z.strictObject({ id: IdUuid }),
    corps: z.strictObject({ id: IdUuid }),
    reponse: z.strictObject({ due_le: Texte }),
    succes: 200,
  },
} satisfies Record<string, DefinitionRoute>
