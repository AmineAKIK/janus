import { z } from 'zod'
import { NoteCarte, TypeDifferee, TypeVerification } from '../enums.ts'
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

/** Une question de début de séance : sans le nom du bloc, pour que les blocs restent mélangés. */
const QuestionDebut = z.strictObject({ id: Identifiant, question: Texte })

const Carte = z.strictObject({ id: Identifiant, bloc: CodeBloc, recto: Texte, verso: Texte })

export const ROUTES_APPRENTISSAGE = {
  'GET /aujourdhui': {
    methode: 'GET',
    chemin: '/aujourdhui',
    reponse: z.strictObject({
      en_retard: z.boolean(),
      taches: z.array(Tache),
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
