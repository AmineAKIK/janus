import { z } from 'zod'
import { Statut } from '../enums.ts'
import { InstantUtc } from '../faits.ts'
import { TacheDuJour } from './apprentissage.ts'
import { CodeBloc, IdUuid, Identifiant, TexteLibre } from './commun.ts'
import type { DefinitionRoute } from './routes.ts'

const Texte = z.string().trim().min(1)

export const Periode = z.enum(['7j', '30j', 'tout'])
export type Periode = z.infer<typeof Periode>

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
    requete: z.strictObject({
      /** Le module affiché ; le premier module importé par défaut. */
      module: Identifiant.optional(),
      /** La période des zones datées ; 30 jours par défaut. */
      periode: Periode.optional(),
    }),
    reponse: z.strictObject({
      /** Les modules importés, pour le sélecteur. */
      modules: z.array(z.strictObject({ id: Identifiant, titre: Texte })),
      module: z.strictObject({ id: Identifiant, titre: Texte }).nullable(),
      periode: Periode,
      /** Les blocs du module dans l'ordre du plan. */
      blocs: z.array(
        z.strictObject({
          bloc: CodeBloc,
          titre_court: Texte,
          partie: z.string(),
          statut: Statut,
          prerequis: z.array(CodeBloc),
          /** Le statut est forcé par Amine. */
          force: z.boolean(),
          /** Redescendu d'un cran après des échecs de vérification. */
          redescendu: z.boolean(),
          /** Ouvert sans que ses prérequis soient validés. */
          prerequis_non_valides: z.boolean(),
        }),
      ),
      a_faire: z.strictObject({
        aujourdhui: z.number().int().min(0),
        /** Dus dans les 7 jours suivants. */
        a_venir: z.number().int().min(0),
        /** Les trois premières tâches, dans l'ordre d'Aujourd'hui. */
        taches: z.array(TacheDuJour).max(3),
      }),
      /** Les erreurs critiques cochées dans la période, les plus fréquentes d'abord. */
      erreurs: z.array(
        z.strictObject({
          erreur: Identifiant,
          libelle: Texte,
          nombre: z.number().int().min(1),
          blocs: z.array(CodeBloc),
          /** Encore ouverte dans au moins un bloc : « À reprendre ». */
          ouverte: z.boolean(),
        }),
      ),
      decisions: z.strictObject({
        forces: z.array(
          z.strictObject({ date: InstantUtc, bloc: CodeBloc, statut: Statut, raison: Texte }),
        ),
        sans_prerequis: z.array(
          z.strictObject({ date: InstantUtc, bloc: CodeBloc, raison: Texte.nullable() }),
        ),
      }),
      cout_ia: z.strictObject({
        /** En millionièmes d'euro, comme `plafondIaMillioniemes`. */
        depense_millioniemes: z.number().int().min(0),
        plafond_millioniemes: z.number().int().min(0),
      }),
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
