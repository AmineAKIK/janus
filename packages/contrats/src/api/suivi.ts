import { z } from 'zod'
import { Confiance, Statut } from '../enums.ts'
import { InstantUtc } from '../faits.ts'
import { TacheDuJour } from './apprentissage.ts'
import { CodeBloc, IdUuid, Identifiant, TexteLibre } from './commun.ts'
import type { DefinitionRoute } from './routes.ts'

const Texte = z.string().trim().min(1)

export const Periode = z.enum(['7j', '30j', 'tout'])
export type Periode = z.infer<typeof Periode>

/** Les types de ligne du journal, dans l'ordre des filtres de Figma. */
export const TypeJournal = z.enum([
  'seance',
  'restitution',
  'consolidation',
  'verification',
  'carte',
  'changement_statut',
  'erreur_critique',
  'contestation',
  'statut_force',
])
export type TypeJournal = z.infer<typeof TypeJournal>

/** Une note d'Amine sur une ligne du journal : 1000 caractères au plus. */
const TexteNote = z.string().trim().min(1).max(1000)

export const NoteJournal = z.strictObject({
  id: IdUuid,
  /** L'identifiant de la ligne annotée. */
  entree: Identifiant,
  date: InstantUtc,
  texte: TexteNote,
})
export type NoteJournal = z.infer<typeof NoteJournal>

export const IdeeJournal = z.strictObject({ id: IdUuid, date: InstantUtc, texte: TexteLibre })
export type IdeeJournal = z.infer<typeof IdeeJournal>

export const LigneJournal = z.strictObject({
  id: Identifiant,
  date: InstantUtc,
  bloc: CodeBloc,
  type: TypeJournal,
  /** La phrase affichée sous « <heure> · <code> · <type> ». */
  resume: Texte,
  /** Ce que la ligne déplie. */
  detail: z.array(Texte),
  /** Présent pour une contestation : vrai tant qu'Amine ne l'a pas tranchée. */
  contestation_en_attente: z.boolean().optional(),
  note: NoteJournal.nullable(),
})
export type LigneJournal = z.infer<typeof LigneJournal>

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
      /** Les mesures de l'apprentissage ; Autonomie et Aisance ne suivent pas la période. */
      mesures: z.strictObject({
        /** Les 4 dernières semaines, la plus ancienne d'abord. */
        autonomie: z.strictObject({
          semaines: z.array(
            z.strictObject({
              /** Le lundi, `AAAA-MM-JJ`. */
              debut: z.string(),
              sans_aide: z.number().int().min(0),
              total: z.number().int().min(0),
              /** Entre 0 et 1 ; `null` sans item cette semaine-là. */
              part: z.number().min(0).max(1).nullable(),
            }),
          ),
          /** Le niveau d'aide moyen de la semaine courante (0 à 4). */
          aide_moyenne: z.number().min(0).max(4).nullable(),
        }),
        /** Les 4 dernières semaines, la plus ancienne d'abord : jamais de total global. */
        retention: z.array(
          z.strictObject({
            /** Le lundi, `AAAA-MM-JJ`. */
            debut: z.string(),
            /** Cartes revues, dont `reussis` notées autrement que « À revoir ». */
            cartes: z.strictObject({
              reussis: z.number().int().min(0),
              total: z.number().int().min(0),
            }),
            /** Questions de début de séance, dont `reussis` au niveau solide. */
            questions: z.strictObject({
              reussis: z.number().int().min(0),
              total: z.number().int().min(0),
            }),
            /** Vérifications valables, dont `reussis` sans erreur au premier tour. */
            verifications: z.strictObject({
              reussis: z.number().int().min(0),
              total: z.number().int().min(0),
            }),
          }),
        ),
        calibration: z.strictObject({
          lignes: z.array(
            z.strictObject({
              confiance: Confiance,
              justes: z.number().int().min(0),
              faux: z.number().int().min(0),
            }),
          ),
          /** Les erreurs commises en étant sûr pendant la semaine courante. */
          erreurs_sures: z.array(
            z.strictObject({ bloc: CodeBloc, question: Identifiant, date: InstantUtc }),
          ),
        }),
        /** Un bloc par ligne, dans l'ordre du plan ; `cible` est `null` quand le bloc n'en a pas. */
        aisance: z.array(
          z.strictObject({
            bloc: CodeBloc,
            titre_court: Texte,
            cible: z
              .strictObject({
                libelle: Texte,
                objectif_s: z.number().int().min(1),
                meilleur_s: z.number().min(0).nullable(),
                reussites: z.number().int().min(0),
                reussites_requises: z.number().int().min(1),
                jours: z.number().int().min(0),
                jours_requis: z.number().int().min(1),
              })
              .nullable(),
          }),
        ),
        /** Le temps actif de la semaine courante, en secondes : une mesure, jamais un objectif. */
        temps: z.strictObject({
          total_s: z.number().int().min(0),
          lecture_s: z.number().int().min(0),
          pratique_s: z.number().int().min(0),
          restitution_s: z.number().int().min(0),
          /** Le plus long d'abord. */
          blocs: z.array(
            z.strictObject({
              bloc: CodeBloc,
              titre_court: Texte,
              secondes: z.number().int().min(1),
            }),
          ),
        }),
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
      /** Le module affiché ; tous les blocs du journal par défaut. */
      module: Identifiant.optional(),
      bloc: CodeBloc.optional(),
      type: TypeJournal.optional(),
      /** Seules les lignes strictement avant cet instant : la page suivante. */
      avant: InstantUtc.optional(),
    }),
    reponse: z.strictObject({
      /** Les modules importés, pour le sélecteur. */
      modules: z.array(z.strictObject({ id: Identifiant, titre: Texte })),
      /** Les lignes, les plus récentes d'abord, 50 par page. */
      entrees: z.array(LigneJournal),
      /** L'instant à passer en `avant` pour la page suivante, `null` à la dernière page. */
      suivant: InstantUtc.nullable(),
      /** L'état de chaque bloc du module : le panneau « État des blocs » et le filtre « Bloc ». */
      blocs: z.array(z.strictObject({ bloc: CodeBloc, titre_court: Texte, statut: Statut })),
      /** « À explorer plus tard » : les idées, les plus récentes d'abord. */
      idees: z.array(IdeeJournal),
    }),
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
    corps: z.strictObject({ id: IdUuid, entree: Identifiant, texte: TexteNote }),
    reponse: NoteJournal,
    succes: 201,
  },
  'PATCH /journal/notes/:id': {
    methode: 'PATCH',
    chemin: '/journal/notes/:id',
    params: z.strictObject({ id: IdUuid }),
    corps: z.strictObject({ texte: TexteNote }),
    reponse: NoteJournal,
    succes: 200,
  },
  'POST /journal/idees': {
    methode: 'POST',
    chemin: '/journal/idees',
    corps: z.strictObject({ id: IdUuid, texte: TexteLibre }),
    reponse: IdeeJournal,
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
