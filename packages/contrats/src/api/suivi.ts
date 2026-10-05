import { z } from 'zod'
import { Statut } from '../enums.ts'
import { InstantUtc } from '../faits.ts'
import { Tache } from './apprentissage.ts'
import { CodeBloc, IdUuid, Identifiant, TexteLibre } from './commun.ts'
import type { DefinitionRoute } from './routes.ts'

const Texte = z.string().trim().min(1)

const EntreeJournal = z.strictObject({
  id: IdUuid,
  date: InstantUtc,
  type: z.enum(['fait', 'note', 'idee']),
  bloc: CodeBloc.nullable(),
  texte: z.string(),
})
export type EntreeJournal = z.infer<typeof EntreeJournal>

export const ROUTES_SUIVI = {
  'GET /tableau-de-bord': {
    methode: 'GET',
    chemin: '/tableau-de-bord',
    reponse: z.strictObject({
      blocs: z.array(
        z.strictObject({
          bloc: CodeBloc,
          titre_court: Texte,
          statut: Statut,
          prerequis: z.array(CodeBloc),
        }),
      ),
      a_faire: z.array(Tache),
      erreurs_ouvertes: z.array(
        z.strictObject({ bloc: CodeBloc, erreur: Identifiant, libelle: Texte }),
      ),
    }),
    succes: 200,
  },
  'GET /journal': {
    methode: 'GET',
    chemin: '/journal',
    requete: z.strictObject({
      avant: InstantUtc.optional(),
      limite: z.coerce.number().int().min(1).max(200).optional(),
    }),
    reponse: z.strictObject({ entrees: z.array(EntreeJournal) }),
    succes: 200,
  },
  'GET /journal/export.txt': {
    methode: 'GET',
    chemin: '/journal/export.txt',
    /** Le journal en texte brut (`text/plain`). */
    reponse: z.string(),
    succes: 200,
  },
  'GET /export.json': {
    methode: 'GET',
    chemin: '/export.json',
    reponse: z.strictObject({
      version: z.literal(1),
      genere_le: InstantUtc,
      donnees: z.record(z.string(), z.json()),
    }),
    succes: 200,
  },
  'POST /journal/notes': {
    methode: 'POST',
    chemin: '/journal/notes',
    corps: z.strictObject({ id: IdUuid, texte: TexteLibre, bloc: CodeBloc.optional() }),
    reponse: EntreeJournal,
    succes: 201,
  },
  'PATCH /journal/notes/:id': {
    methode: 'PATCH',
    chemin: '/journal/notes/:id',
    params: z.strictObject({ id: IdUuid }),
    corps: z.strictObject({ texte: TexteLibre }),
    reponse: EntreeJournal,
    succes: 200,
  },
  'POST /journal/idees': {
    methode: 'POST',
    chemin: '/journal/idees',
    corps: z.strictObject({ id: IdUuid, texte: TexteLibre }),
    reponse: EntreeJournal,
    succes: 201,
  },
  'POST /revues-methode': {
    methode: 'POST',
    chemin: '/revues-methode',
    corps: z.strictObject({ id: IdUuid, texte: TexteLibre }),
    reponse: null,
    succes: 204,
  },
} satisfies Record<string, DefinitionRoute>
