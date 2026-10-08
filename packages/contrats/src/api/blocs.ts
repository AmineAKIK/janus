import { z } from 'zod'
import { Statut } from '../enums.ts'
import { MessagePage, EtatPage } from '../pont.ts'
import { InstantUtc } from '../faits.ts'
import { AccesBloc } from './catalogue.ts'
import { TypeEtape } from '../manifeste.ts'
import { CodeBloc, IdUuid, Identifiant, StatutBloc } from './commun.ts'
import type { DefinitionRoute } from './routes.ts'

const Texte = z.string().trim().min(1)
const ParamBloc = z.strictObject({ id: CodeBloc })

/** Le temps passé dans l'appli : émis par l'appli elle-même, jamais par la page. */
export const TempsActif = z.strictObject({
  id: IdUuid,
  type: z.literal('temps.actif'),
  bloc: CodeBloc,
  secondes: z.number().int().min(1),
  /** Le type de l'étape affichée pendant ce temps ; absent quand la page ne le sait pas. */
  etape: TypeEtape.optional(),
})
export type TempsActif = z.infer<typeof TempsActif>

export const ROUTES_BLOCS = {
  'POST /blocs/:id/ouvrir': {
    methode: 'POST',
    chemin: '/blocs/:id/ouvrir',
    params: ParamBloc,
    corps: z.strictObject({
      /** Identifiant de l'événement d'ouverture, tiré une fois par le client. */
      id: IdUuid,
      hors_prerequis: z.boolean(),
      raison: Texte.optional(),
    }),
    reponse: z.strictObject({ acces: AccesBloc, ...StatutBloc.shape }),
    succes: 200,
  },
  'POST /evenements': {
    methode: 'POST',
    chemin: '/evenements',
    corps: z.union([MessagePage, TempsActif]),
    reponse: z.strictObject({
      /** Vrai si le serveur avait déjà reçu cet identifiant : rien n'est enregistré deux fois. */
      doublon: z.boolean(),
      /** Le statut recalculé du bloc, `null` pour un événement qui n'en change aucun. */
      statut: StatutBloc.nullable(),
    }),
    succes: 200,
  },
  'PUT /blocs/:id/etat-page': {
    methode: 'PUT',
    chemin: '/blocs/:id/etat-page',
    params: ParamBloc,
    corps: z.strictObject({
      /** La version de l'état que l'onglet a lue (0 s'il n'y en avait pas). */
      version: z.number().int().min(0),
      etat: EtatPage,
    }),
    reponse: z.strictObject({ version: z.number().int().min(1) }),
    succes: 200,
  },
  'POST /blocs/:id/erreurs': {
    methode: 'POST',
    chemin: '/blocs/:id/erreurs',
    params: ParamBloc,
    corps: z.strictObject({
      /** Identifiant de la décision, tiré une fois par le client. */
      id: IdUuid,
      erreur: Identifiant,
      /** Correction qui a proposé l'erreur. */
      correction: IdUuid,
      decision: z.enum(['confirmee', 'rejetee']),
    }),
    reponse: StatutBloc,
    succes: 200,
  },
  'POST /blocs/:id/forcer': {
    methode: 'POST',
    chemin: '/blocs/:id/forcer',
    params: ParamBloc,
    corps: z.discriminatedUnion('action', [
      z.strictObject({
        action: z.literal('forcer'),
        id: IdUuid,
        statut: Statut,
        raison: Texte,
      }),
      z.strictObject({ action: z.literal('lever'), id: IdUuid }),
    ]),
    reponse: z.strictObject({
      ...StatutBloc.shape,
      force: z.strictObject({ statut: Statut, raison: Texte }).nullable(),
      statut_calcule: Statut,
    }),
    succes: 200,
  },
} satisfies Record<string, DefinitionRoute>

/** Le conflit de version d'un état de page : la réponse 409 porte l'état actuel. */
export const ConflitEtatPage = z.strictObject({
  type: z.string().min(1),
  title: z.string().min(1),
  status: z.literal(409),
  detail: z.string(),
  code: z.literal('conflit'),
  version: z.number().int().min(1),
  etat: EtatPage,
  modifie_le: InstantUtc,
})
