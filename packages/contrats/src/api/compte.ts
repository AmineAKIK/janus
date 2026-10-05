import { z } from 'zod'
import { IdUuid, InstantUtc } from './commun.ts'
import type { DefinitionRoute } from './routes.ts'

const Texte = z.string().trim().min(1)

export const Moi = z.strictObject({
  id: IdUuid,
  nom_utilisateur: Texte,
  fuseau: Texte,
})
export type Moi = z.infer<typeof Moi>

const SessionAppareil = z.strictObject({
  id: IdUuid,
  appareil: z.string(),
  creee_le: InstantUtc,
  derniere_activite: InstantUtc,
  /** Vrai pour la session qui fait la requête. */
  courante: z.boolean(),
})

const MotDePasse = z.string().min(8, { error: 'Le mot de passe doit faire au moins 8 caractères.' })

export const ROUTES_COMPTE = {
  'POST /session': {
    methode: 'POST',
    chemin: '/session',
    corps: z.strictObject({ nom_utilisateur: Texte, mot_de_passe: z.string().min(1) }),
    reponse: Moi,
    succes: 200,
  },
  'DELETE /session': { methode: 'DELETE', chemin: '/session', reponse: null, succes: 204 },
  'GET /moi': { methode: 'GET', chemin: '/moi', reponse: Moi, succes: 200 },
  'PATCH /moi/mot-de-passe': {
    methode: 'PATCH',
    chemin: '/moi/mot-de-passe',
    corps: z.strictObject({ ancien: z.string().min(1), nouveau: MotDePasse }),
    reponse: null,
    succes: 204,
  },
  'GET /sessions': {
    methode: 'GET',
    chemin: '/sessions',
    reponse: z.strictObject({ sessions: z.array(SessionAppareil) }),
    succes: 200,
  },
  'DELETE /sessions/:id': {
    methode: 'DELETE',
    chemin: '/sessions/:id',
    params: z.strictObject({ id: IdUuid }),
    reponse: null,
    succes: 204,
  },
  'DELETE /compte': {
    methode: 'DELETE',
    chemin: '/compte',
    corps: z.strictObject({ mot_de_passe: z.string().min(1) }),
    reponse: null,
    succes: 204,
  },
} satisfies Record<string, DefinitionRoute>
